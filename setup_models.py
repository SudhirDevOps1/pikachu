import os
import urllib.request
import zipfile
import shutil

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

PIPER_DIR = os.path.join(MODELS_DIR, "piper")
WHISPER_DIR = os.path.join(MODELS_DIR, "whisper")

# URLs
PIPER_MODEL_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx"
PIPER_CONFIG_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx.json"

WHISPER_MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
WHISPER_BIN_ZIP_URL = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip"

def download_file(url, dest_path, desc):
    if os.path.exists(dest_path):
        print(f"[OK] {desc} already exists at {dest_path}")
        return
    print(f"[*] Downloading {desc}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(dest_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        print(f"[+] Successfully downloaded {desc}")
    except Exception as e:
        print(f"[!] Error downloading {desc}: {e}")

def setup_piper():
    os.makedirs(PIPER_DIR, exist_ok=True)
    piper_model_dest = os.path.join(PIPER_DIR, "hi.onnx")
    piper_config_dest = os.path.join(PIPER_DIR, "hi.onnx.json")
    
    download_file(PIPER_MODEL_URL, piper_model_dest, "Piper Hindi Model (ONNX)")
    download_file(PIPER_CONFIG_URL, piper_config_dest, "Piper Hindi Model Config")

def setup_whisper():
    os.makedirs(WHISPER_DIR, exist_ok=True)
    whisper_model_dest = os.path.join(WHISPER_DIR, "ggml-tiny.bin")
    download_file(WHISPER_MODEL_URL, whisper_model_dest, "Whisper Tiny Model")
    
    whisper_exe = os.path.join(WHISPER_DIR, "main.exe")
    if os.path.exists(whisper_exe):
        print(f"[OK] Whisper executable already exists at {whisper_exe}")
        return
    
    zip_dest = os.path.join(WHISPER_DIR, "whisper-bin.zip")
    download_file(WHISPER_BIN_ZIP_URL, zip_dest, "Whisper Windows Binaries")
    
    if os.path.exists(zip_dest):
        print("[*] Extracting Whisper binaries...")
        try:
            with zipfile.ZipFile(zip_dest, 'r') as zip_ref:
                zip_ref.extractall(WHISPER_DIR)
            os.remove(zip_dest)
            print("[+] Extracted Whisper binaries.")
        except Exception as e:
            print(f"[!] Error extracting whisper zip: {e}")

VOSK_MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip"
VOSK_DIR = os.path.join(MODELS_DIR, "vosk")

def setup_vosk():
    os.makedirs(VOSK_DIR, exist_ok=True)
    if os.path.exists(os.path.join(VOSK_DIR, "am")):
        print(f"[OK] Vosk Hindi Model already exists at {VOSK_DIR}")
        return
    
    zip_dest = os.path.join(MODELS_DIR, "vosk.zip")
    download_file(VOSK_MODEL_URL, zip_dest, "Vosk Hindi Model (0.22)")
    
    if os.path.exists(zip_dest):
        print("[*] Extracting Vosk model...")
        try:
            with zipfile.ZipFile(zip_dest, 'r') as zip_ref:
                zip_ref.extractall(VOSK_DIR)
            os.remove(zip_dest)
            
            # The zip contains a folder named vosk-model-small-hi-0.22
            extracted_folder = os.path.join(VOSK_DIR, "vosk-model-small-hi-0.22")
            if os.path.exists(extracted_folder):
                for item in os.listdir(extracted_folder):
                    shutil.move(os.path.join(extracted_folder, item), VOSK_DIR)
                os.rmdir(extracted_folder)
            
            print("[+] Extracted Vosk model.")
        except Exception as e:
            print(f"[!] Error extracting vosk zip: {e}")

if __name__ == "__main__":
    print("====================================================")
    print("       PIKA AI ASSISTANT - MODEL SETUP CHECK        ")
    print("====================================================")
    print("Checking if required models (Piper, Whisper, Vosk) exist in models/ ...\n")
    setup_piper()
    setup_whisper()
    setup_vosk()
    print("\n[OK] Setup check complete.")
    print("====================================================")
