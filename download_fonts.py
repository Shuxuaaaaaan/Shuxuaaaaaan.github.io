import os
import urllib.request

fonts = [
    "KaTeX_AMS-Regular",
    "KaTeX_Caligraphic-Bold",
    "KaTeX_Caligraphic-Regular",
    "KaTeX_Fraktur-Bold",
    "KaTeX_Fraktur-Regular",
    "KaTeX_Main-Bold",
    "KaTeX_Main-BoldItalic",
    "KaTeX_Main-Italic",
    "KaTeX_Main-Regular",
    "KaTeX_Math-BoldItalic",
    "KaTeX_Math-Italic",
    "KaTeX_SansSerif-Bold",
    "KaTeX_SansSerif-Italic",
    "KaTeX_SansSerif-Regular",
    "KaTeX_Script-Regular",
    "KaTeX_Size1-Regular",
    "KaTeX_Size2-Regular",
    "KaTeX_Size3-Regular",
    "KaTeX_Size4-Regular",
    "KaTeX_Typewriter-Regular"
]

extensions = ["woff2", "woff", "ttf"]
base_url = "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/fonts/"
target_dir = os.path.join("css", "vendor", "fonts")

if not os.path.exists(target_dir):
    os.makedirs(target_dir)

for font in fonts:
    for ext in extensions:
        filename = f"{font}.{ext}"
        url = base_url + filename
        path = os.path.join(target_dir, filename)
        if os.path.exists(path):
            continue
        print(f"Downloading {filename}...")
        try:
            with urllib.request.urlopen(url) as response, open(path, 'wb') as out_file:
                out_file.write(response.read())
        except Exception as e:
            print(f"Error downloading {filename}: {e}")

print("Done.")
