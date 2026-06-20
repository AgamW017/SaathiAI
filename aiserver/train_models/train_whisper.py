import os
import numpy as np
import torch
import evaluate
import wandb
from dataclasses import dataclass
from typing import Any, Dict, List, Union
from datasets import load_from_disk
from transformers import (
    WhisperForConditionalGeneration,
    WhisperProcessor,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
)
from peft import LoraConfig, get_peft_model
os.environ['HF_TOKEN'] = "token here"
os.environ["WANDB_API_KEY"] = "token here"
# os.environ["NCCL_P2P_DISABLE"] = "1"
# os.environ["NCCL_IB_DISABLE"] = "1"

MODEL_ID = os.environ.get("WHISPER_MODEL", "openai/whisper-small")
IS_MEDIUM = "medium" in MODEL_ID
OUTPUT_DIR = f"./whisper-fleurs-hi-mr-gu-bn-{MODEL_ID.split('/')[-1]}"
HUB_MODEL_ID = f"saaranshgarg1/{OUTPUT_DIR.strip('./')}"  # change this

wandb.login(key=os.environ["WANDB_API_KEY"])
os.environ["WANDB_PROJECT"] = "whisper-indic-fleurs"

processor = WhisperProcessor.from_pretrained(MODEL_ID, task="transcribe")
model = WhisperForConditionalGeneration.from_pretrained(MODEL_ID)
lora_config = LoraConfig(
    r=32,
    lora_alpha=64,
    target_modules=["q_proj", "v_proj", "k_proj", "out_proj", "fc1", "fc2"],
    lora_dropout=0.05,
    bias="none",
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
model.generation_config.task = "transcribe"
model.generation_config.forced_decoder_ids = None  # multilingual: let it predict language token

dataset = load_from_disk("fleurs_processed")
# MAX_LABEL_LEN = 448

# def label_length_ok(example):
#     return len(example["labels"]) <= MAX_LABEL_LEN

# print("Pre-filter sizes:", {k: len(v) for k, v in dataset.items()})
# dataset = dataset.filter(label_length_ok, num_proc=4)
# print("Post-filter sizes:", {k: len(v) for k, v in dataset.items()})

@dataclass
class DataCollatorSpeechSeq2SeqWithPadding:
    processor: Any

    def __call__(self, features: List[Dict[str, Union[List[int], torch.Tensor]]]) -> Dict[str, torch.Tensor]:
        input_features = [{"input_features": f["input_features"]} for f in features]
        batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")

        label_features = [{"input_ids": f["labels"]} for f in features]
        labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
        labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)

        if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
            labels = labels[:, 1:]

        batch["labels"] = labels
        return batch

data_collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)

wer_metric = evaluate.load("wer")

import re
import unicodedata

def normalize_indic_text(text):
    text = unicodedata.normalize("NFC", text)
    text = text.replace("।", ".")  # danda -> period, optional but common
    text = re.sub(r"[^\w\s]", "", text)  # strip punctuation for WER fairness
    text = re.sub(r"\s+", " ", text).strip()
    return text

def compute_metrics(pred):
    pred_ids = pred.predictions
    label_ids = pred.label_ids
    label_ids[label_ids == -100] = processor.tokenizer.pad_token_id

    pred_str = processor.tokenizer.batch_decode(pred_ids, skip_special_tokens=True)
    label_str = processor.tokenizer.batch_decode(label_ids, skip_special_tokens=True)

    pred_str = [normalize_indic_text(p) for p in pred_str]
    label_str = [normalize_indic_text(l) for l in label_str]

    wer = 100 * wer_metric.compute(predictions=pred_str, references=label_str)
    return {"wer": wer}

# --- Memory-aware batch/grad-accum settings for 2x T4 (16GB each) ---
if IS_MEDIUM:
    per_device_train_bs = 4
    per_device_eval_bs = 4
    grad_accum = 8          # effective batch = 4 * 8 * 2 GPUs = 64
    grad_checkpointing = True
    optim = "adamw_bnb_8bit"
else:  # whisper-small
    per_device_train_bs = 16
    per_device_eval_bs = 8
    grad_accum = 2          # effective batch = 16 * 2 * 2 GPUs = 64
    grad_checkpointing = True
    optim = "adamw_bnb_8bit"

training_args = Seq2SeqTrainingArguments(
    output_dir=OUTPUT_DIR,
    per_device_train_batch_size=per_device_train_bs,
    per_device_eval_batch_size=per_device_eval_bs,
    gradient_accumulation_steps=grad_accum,
    gradient_checkpointing=grad_checkpointing,
    gradient_checkpointing_kwargs={"use_reentrant": False},
    learning_rate=1e-5,
    fp16=True,                      # T4 supports fp16, not bf16
    fp16_full_eval=True,
    eval_strategy="steps",
    warmup_steps=50,   # was 500 — way too high for ~125 total steps
    num_train_epochs=20,  # small dataset, more epochs needed
    eval_steps=50,
    save_steps=50,
    logging_steps=25,
    predict_with_generate=True,
    generation_max_length=225,
    save_total_limit=3,
    load_best_model_at_end=True,
    metric_for_best_model="wer",
    greater_is_better=False,
    report_to=["wandb"],
    run_name=f"{MODEL_ID.split('/')[-1]}-fleurs-indic",
    push_to_hub=True,
    hub_model_id=HUB_MODEL_ID,
    hub_token=os.environ["HF_TOKEN"],
    optim=optim,
    dataloader_num_workers=4,
    ddp_find_unused_parameters=False,
)

trainer = Seq2SeqTrainer(
    args=training_args,
    model=model,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    data_collator=data_collator,
    compute_metrics=compute_metrics,
    processing_class=processor.feature_extractor,
)
if __name__ == "__main__":
    trainer.train()
    trainer.push_to_hub()

    # Ensure consistent dtype before final prediction — avoids the
    # "Input type (float) and bias type (c10::Half)" crash that can occur
    # after load_best_model_at_end reloads a checkpoint.
    # trainer.model = trainer.model.half().to(trainer.args.device)
    trainer.args.fp16_full_eval = False
    trainer.model = trainer.model.float()
    test_results = trainer.predict(dataset["test"])
    print("Overall test WER:", test_results.metrics["test_wer"])