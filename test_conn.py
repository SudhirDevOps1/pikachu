import asyncio
import websockets
import json

async def test_conn():
    try:
        async with websockets.connect("ws://127.0.0.1:8765") as ws:
            print("Connected successfully!")
            msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
            print("Received info:", msg[:100])
    except Exception as e:
        print("Failed to connect or receive:", e)

asyncio.run(test_conn())
