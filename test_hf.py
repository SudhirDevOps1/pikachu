import urllib.request
url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/swara/medium/hi_IN-swara-medium.onnx"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        print("Success!", response.status)
except Exception as e:
    print("Failed:", e)
