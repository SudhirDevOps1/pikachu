import json

try:
    with open("pika_data.json", "r") as f:
        print(f.read())
except Exception as e:
    print("Error:", e)
