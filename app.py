import os, requests
from flask import Flask, jsonify, request, render_template_string

app = Flask(__name__)

ALPACA_KEY = os.getenv("ALPACA_API_KEY") or os.getenv("ALPACA_API_KEY_ID")
ALPACA_SECRET = os.getenv("ALPACA_SECRET_KEY") or os.getenv("ALPACA_API_SECRET_KEY")
DATA_URL = "https://data.alpaca.markets"

DEFAULTS = ["SPY","QQQ","NVDA","TSLA","AAPL","BTC/USD","ETH/USD","SOL/USD","DOGE/USD","XRP/USD"]

def headers():
    return {
        "APCA-API-KEY-ID": ALPACA_KEY or "",
        "APCA-API-SECRET-KEY": ALPACA_SECRET or ""
    }

def stock_pressure(symbol):
    trade = requests.get(f"{DATA_URL}/v2/stocks/{symbol}/trades/latest", headers=headers(), timeout=8).json()
    bar = requests.get(f"{DATA_URL}/v2/stocks/{symbol}/bars/latest", headers=headers(), timeout=8).json()
    price = float(trade["trade"]["p"])
    open_price = float(bar["bar"]["o"])
    raw = ((price - open_price) / open_price) * 100
    pressure = max(0, min(100, 50 + raw * 12))
    side = "BULL" if raw >= 0 else "BEAR"
    return price, raw, pressure, side

def crypto_pressure(symbol):
    sym = symbol if "/" in symbol else symbol + "/USD"
    url = f"{DATA_URL}/v1beta3/crypto/us/latest/bars?symbols={sym}"
    data = requests.get(url, headers=headers(), timeout=8).json()
    bar = data["bars"][sym]
    price = float(bar["c"])
    open_price = float(bar["o"])
    raw = ((price - open_price) / open_price) * 100
    pressure = max(0, min(100, 50 + raw * 20))
    side = "BULL" if raw >= 0 else "BEAR"
    return price, raw, pressure, side

@app.route("/api/read")
def api_read():
    symbol = request.args.get("symbol","SPY").upper().strip()
    kind = request.args.get("kind","stock")

    try:
        if kind == "crypto" or "/" in symbol:
            price, raw, pressure, side = crypto_pressure(symbol)
        else:
            price, raw, pressure, side = stock_pressure(symbol)

        return jsonify({
            "symbol": symbol,
            "price": round(price, 4),
            "raw_percent": round(raw, 3),
            "pressure": round(pressure, 1),
            "side": side
        })
    except Exception as e:
        return jsonify({"error": str(e), "symbol": symbol}), 500

@app.route("/api/defaults")
def api_defaults():
    return jsonify(DEFAULTS)

HTML = """
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Live Seal Reader</title>
<style>
body{margin:0;background:#020617;color:white;font-family:Arial}
.wrap{padding:16px;max-width:1000px;margin:auto}
.card{background:#07111f;border:1px solid #164e63;border-radius:22px;padding:20px;margin:16px 0}
input,button{font-size:18px;border-radius:12px;border:0;padding:13px;margin:5px}
input{background:#111827;color:white}
button{background:#22d3ee;font-weight:bold}
.reader{background:#0f172a;border:1px solid #334155;border-radius:18px;padding:16px;margin:12px 0;position:relative;overflow:hidden}
.laser{height:4px;background:linear-gradient(90deg,transparent,#67e8f9,white,#67e8f9,transparent);position:absolute;left:-40%;top:50%;width:40%;animation:scan 2s linear infinite}
@keyframes scan{to{left:120%}}
.meter{height:32px;background:#111827;border-radius:999px;overflow:hidden;border:1px solid #334155}
.fill{height:100%;background:linear-gradient(90deg,#22c55e,#06b6d4)}
.bear{background:linear-gradient(90deg,#ef4444,#f97316)}
.danger{color:#fb7185}.warn{color:#facc15}.big{font-size:24px;font-weight:bold}
</style>
</head>
<body>
<div class="wrap">
<div class="card">
<h1>Live Market Seal Reader</h1>
<button onclick="enableNotes()">Enable Real Browser Alerts</button>
<p id="note">Notifications OFF</p>
<input id="sym" placeholder="Ticker ex: SPY or BTC/USD">
<button onclick="addReader('stock')">Search Stock</button>
<button onclick="addReader('crypto')">Search Crypto</button>
</div>
<div class="card" id="readers"></div>
</div>

<script>
let alerts=false;
let readers=[];
let sealFired={};

function enableNotes(){
 if(Notification.permission==="granted"){alerts=true;note.innerText="Notifications ON";return}
 Notification.requestPermission().then(p=>{
  alerts=p==="granted";
  note.innerText=alerts?"Notifications ON":"Notifications BLOCKED";
 });
}

function sound(final=false){
 let ctx=new AudioContext();
 [final?140:720, final?90:980, final?60:1220].forEach((f,i)=>{
  let o=ctx.createOscillator(), g=ctx.createGain();
  o.connect(g);g.connect(ctx.destination);o.frequency.value=f;g.gain.value=.08;
  o.start(ctx.currentTime+i*.12);o.stop(ctx.currentTime+i*.12+.18);
 });
 setTimeout(()=>ctx.close(),900);
}

function ping(r,msg,final=false){
 sound(final);
 if(alerts) new Notification(r.symbol+" "+msg,{body:r.side+" "+r.pressure+"% price $"+r.price});
}

function stage(p){
 if(p>=60) return ["FINAL SEAL BREAK / POWER DOWN GET OUT","danger"];
 if(p>=55) return ["55%-60% SWEET SPOT BALANCE / FAKEOUT WATCH","warn"];
 if(p>=45) return ["45%-55% BIRTH OF TREND",""];
 return ["UNDER 45% PREBIRTH WATCH",""];
}

function addReader(kind){
 let s=document.getElementById("sym").value.trim().toUpperCase();
 if(!s)return;
 readers.push({symbol:s,kind:kind});
 document.getElementById("sym").value="";
 draw();
}

async function loadDefault(){
 let res=await fetch("/api/defaults"); let arr=await res.json();
 readers=arr.map(s=>({symbol:s,kind:s.includes("/")?"crypto":"stock"}));
 draw();
}

async function draw(){
 let html="<h2>10 Live + Search Readers</h2>";
 for(let r of readers){
  try{
   let res=await fetch(`/api/read?symbol=${encodeURIComponent(r.symbol)}&kind=${r.kind}`);
   let d=await res.json(); Object.assign(r,d);
   let st=stage(r.pressure);
   let key=r.symbol+"-"+st[0];

   if(r.pressure>=55 && !sealFired[key]){
    ping(r,st[0],r.pressure>=60);
    sealFired[key]=true;
   }

   html+=`<div class="reader">
    <div class="laser"></div>
    <div class="big">${r.symbol} — ${r.side} ${r.pressure}%</div>
    <p>Real move from open: ${r.raw_percent}% | Price: $${r.price}</p>
    <div class="meter"><div class="fill ${r.side==="BEAR"?"bear":""}" style="width:${r.pressure}%"></div></div>
    <h3 class="${st[1]}">${st[0]}</h3>
    <p>${r.pressure>=60?"FINAL SEAL PING FIRED: power down / exit watch.":"Balancing and reading live pressure."}</p>
   </div>`;
  }catch(e){
   html+=`<div class="reader">${r.symbol} loading/error</div>`;
  }
 }
 document.getElementById("readers").innerHTML=html;
}

setInterval(draw,15000);
loadDefault();
</script>
</body>
</html>
"""

@app.route("/")
def home():
    return render_template_string(HTML)

@app.route("/healthz")
def healthz():
    return "OK", 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
