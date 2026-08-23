import asyncio
import websockets
async def test():
    async with websockets.connect('ws://localhost:8765') as ws:
        print('Connected!')
        await asyncio.sleep(2)
        print('Sending data')
        await ws.send('{\"type\":\"save_data\"}')
        await asyncio.sleep(2)
        print('Done')
asyncio.run(test())
