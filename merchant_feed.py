import json
from datetime import datetime

products = [
    {
        "id": "laser-reader-1",
        "title": "Laser Signal Reader",
        "description": "Live stock and crypto pressure reader",
        "price": "49.99 USD",
        "availability": "in stock",
        "condition": "new",
        "brand": "Market",
        "return_policy": "30-day refund if product or delivery fails"
    },
    {
        "id": "nft-signal-pack",
        "title": "NFT Signal Pack",
        "description": "Digital NFT signal access",
        "price": "99.99 USD",
        "availability": "in stock",
        "condition": "new",
        "brand": "Market",
        "return_policy": "Refund only if delivery or wallet transfer fails"
    }
]

feed = {
    "generated": str(datetime.utcnow()),
    "products": products
}

with open("merchant_feed.json","w") as f:
    json.dump(feed,f,indent=2)

print("merchant_feed.json generated")
