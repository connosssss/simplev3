import os

topsrcdir = os.path.dirname(os.path.abspath(__file__))
win_rs_dir = r"C:\Users\conno\.mozbuild_clean\windows-rs"

in_tree_cargo = os.path.join(topsrcdir, "build", "rust", "windows", "Cargo.toml")
target_cargo = os.path.join(win_rs_dir, "Cargo.toml")

DEPENDENCIES = '\n[dependencies.mozbuild]\nversion = "0.1"\n'

with open(in_tree_cargo, "r", encoding="utf-8") as f:
    raw_cargo_toml = f.read()

# Normalize line endings for reliable matching
raw_cargo_toml = raw_cargo_toml.replace('\r\n', '\n')

if raw_cargo_toml.endswith(DEPENDENCIES):
    raw_cargo_toml_orig = raw_cargo_toml[:-len(DEPENDENCIES)] + "\n"
else:
    # Fallback: find and remove the section
    idx = raw_cargo_toml.find("[dependencies.mozbuild]")
    if idx != -1:
        raw_cargo_toml_orig = raw_cargo_toml[:idx].rstrip() + "\n"
    else:
        raw_cargo_toml_orig = raw_cargo_toml

os.makedirs(win_rs_dir, exist_ok=True)
with open(target_cargo, "w", encoding="utf-8") as f:
    f.write(raw_cargo_toml_orig)

print("FIXED WINDOWS-RS CARGO.TOML!")
