import os
from datasets import load_dataset, concatenate_datasets, Audio, DatasetDict
from transformers import WhisperFeatureExtractor, WhisperTokenizer, WhisperProcessor


os.environ['HF_TOKEN'] = "token here"
MODEL_ID = os.environ.get("WHISPER_MODEL", "openai/whisper-small")
LANGS = ["hi_in", "mr_in", "gu_in", "bn_in"]  # FLEURS codes: Hindi, Marathi, Gujarati, Bengali
LANG_TOKEN_MAP = {
    "hi_in": "hindi",
    "mr_in": "marathi",
    "gu_in": "gujarati",
    "bn_in": "bengali",
}
N_TRAIN_PER_LANG = 500
N_EVAL_PER_LANG = 50  # used for both validation and test subsets

# Whisper's decoder has a hard position limit — any label sequence longer than
# this will crash training with: "Labels' sequence length X cannot exceed the
# maximum allowed length of 448 tokens." Filtering here means train.py never
# has to deal with it, and never has to .filter() after CUDA/DDP is initialized.
MAX_LABEL_LEN = 448

feature_extractor = WhisperFeatureExtractor.from_pretrained(MODEL_ID)
tokenizer = WhisperTokenizer.from_pretrained(MODEL_ID, task="transcribe")
processor = WhisperProcessor.from_pretrained(MODEL_ID, task="transcribe")


def load_fleurs_multilingual(split, n_per_lang):
    subsets = []
    for lang in LANGS:
        ds = load_dataset("google/fleurs", lang, split=split, trust_remote_code=True)
        ds = ds.shuffle(seed=42)
        n = min(n_per_lang, len(ds))
        ds = ds.select(range(n))
        ds = ds.cast_column("audio", Audio(sampling_rate=16000))
        ds = ds.add_column("lang_tag", [lang] * len(ds))
        subsets.append(ds)
    return concatenate_datasets(subsets).shuffle(seed=42)


def build_dataset():
    train = load_fleurs_multilingual("train", N_TRAIN_PER_LANG)
    val = load_fleurs_multilingual("validation", N_EVAL_PER_LANG)
    test = load_fleurs_multilingual("test", N_EVAL_PER_LANG)
    return DatasetDict({"train": train, "validation": val, "test": test})


def prepare_batch(batch):
    audio = batch["audio"]
    batch["input_features"] = feature_extractor(
        audio["array"], sampling_rate=audio["sampling_rate"]
    ).input_features[0]

    lang = LANG_TOKEN_MAP[batch["lang_tag"]]
    tokenizer.set_prefix_tokens(language=lang, task="transcribe")
    batch["labels"] = tokenizer(batch["transcription"]).input_ids
    return batch

if __name__ == "__main__":
    raw = build_dataset()
    print("Raw sizes:", {k: len(v) for k, v in raw.items()})

    # Keep lang_tag through the map so we can report per-language filtering/stats,
    # then drop it at the very end since the Trainer/collator don't need it.
    cols_to_remove = [c for c in raw["train"].column_names if c not in ("lang_tag",)]
    processed = raw.map(
        prepare_batch,
        remove_columns=cols_to_remove,
        num_proc=4,
    )

    before = {k: len(v) for k, v in processed.items()}
    processed = processed.filter(lambda ex: len(ex["labels"]) <= MAX_LABEL_LEN, num_proc=4)
    after = {k: len(v) for k, v in processed.items()}
    print("Filtered out long-label examples:", {k: before[k] - after[k] for k in before})

    # Per-language counts after filtering, for a quick sanity check
    for split in processed:
        tags = processed[split]["lang_tag"]
        counts = {lang: tags.count(lang) for lang in LANGS}
        print(f"{split} per-language counts:", counts)

    processed = processed.remove_columns(["lang_tag"])
    processed.save_to_disk("fleurs_processed")
    print(processed)
    for split in processed:
        print(split, len(processed[split]), "examples")