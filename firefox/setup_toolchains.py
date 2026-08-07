import os
import re
import shutil
import tarfile
import zstandard

src_root = r"C:\Users\conno\.mozbuild"
dst_root = r"C:\Users\conno\.mozbuild_clean"
toolchains_dir = r"C:\Users\conno\.mozbuild\toolchains"

os.makedirs(dst_root, exist_ok=True)

# Copy accessible state items
for item in os.listdir(src_root):
    if item == "clang":
        continue
    src_path = os.path.join(src_root, item)
    dst_path = os.path.join(dst_root, item)
    if os.path.exists(dst_path):
        continue
    try:
        if os.path.isdir(src_path):
            shutil.copytree(src_path, dst_path, dirs_exist_ok=True)
        else:
            shutil.copy2(src_path, dst_path)
    except Exception as e:
        print(f"Skipped copy {item}: {e}")

# Unpack all toolchain archives into dst_root
for filename in os.listdir(toolchains_dir):
    archive_path = os.path.join(toolchains_dir, filename)
    if not (filename.endswith(".tar.zst") or filename.endswith(".tar.xz")):
        continue

    match = re.search(r"%2F([^%]+)\.tar\.(zst|xz)$", filename)
    if not match:
        match = re.search(r"-([a-zA-Z0-9_-]+)\.tar\.(zst|xz)$", filename)
    if not match:
        continue

    tool_name = match.group(1)
    target_dir = os.path.join(dst_root, tool_name)
    os.makedirs(target_dir, exist_ok=True)

    try:
        if filename.endswith(".tar.zst"):
            dctx = zstandard.ZstdDecompressor()
            with open(archive_path, "rb") as fh:
                stream = dctx.stream_reader(fh)
                with tarfile.open(mode="r|", fileobj=stream, bufsize=1024 * 1024) as tar:
                    for m in tar:
                        try:
                            tar.extract(m, path=target_dir)
                        except Exception:
                            pass
        elif filename.endswith(".tar.xz"):
            with tarfile.open(archive_path, mode="r:xz") as tar:
                for m in tar:
                    try:
                        tar.extract(m, path=target_dir)
                    except Exception:
                        pass
    except Exception as e:
        print(f"Error unpacking {tool_name}: {e}")

    # Flatten nested folder if extracted as target_dir/tool_name/...
    nested_dir = os.path.join(target_dir, tool_name)
    if os.path.exists(nested_dir) and os.path.isdir(nested_dir):
        for child in os.listdir(nested_dir):
            src = os.path.join(nested_dir, child)
            dst = os.path.join(target_dir, child)
            if not os.path.exists(dst):
                try:
                    shutil.move(src, dst)
                except Exception:
                    pass
        try:
            os.rmdir(nested_dir)
        except Exception:
            pass

print("SETUP TOOLCHAINS COMPLETE!")
