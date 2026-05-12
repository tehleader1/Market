
app = Flask(__name__)

HTML = """
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laser Seal Reader</title>
<style>
body{margin:0;background:#020617;color:white;font-family:Arial}
.wrap{padding:16px;max-width:950px;margin:auto}
.card{background:#07111f;border:1px solid #164e63;border-radius:22px;padding:20px;margin:16px 0;box-shadow:0 0 28px #0891b244}
h1{font-size:36px;margin:8px 0}
input,button{font-size:18px;border-radius:14px;border:0;padding:14px;margin:6px 0}
input{width:100%;box-sizing:border-box;background:#111827;color:white}
button{background:#22d3ee;color:#00111a;font-weight:bold}
.row{display:grid;grid-template-columns:1fr auto;gap:8px}
.reader{background:#0f172a;border:1px solid #334155;border-radius:20px;padding:18px;margin:15px 0;position:relative;overflow:hidden}
.laser{height:4px;background:linear-gradient(90deg,transparent,#67e8f9,white,#67e8f9,transparent);position:absolute;left:-40%;top:50%;width:40%;animation:slowlaser 4s linear infinite}
.medium .laser{animation:medlaser 1.6s linear infinite}
.fast .laser{animation:fastlaser .75s linear infinite}
@keyframes slowlaser{to{left:110%}}
@keyframes medlaser{0%{left:-40%}50%{left:100%}100%{left:-40%}}
@keyframes fastlaser{to{left:110%}}
.meter{height:34px;background:#111827;border-radius:999px;overflow:hidden;margin:10px 0;border:1px solid #334155}
.fill{height:100%;transition:.5s;background:linear-gradient(90deg,#22c55e,#06b6d4)}
.bearfill{background:linear-gradient(90deg,#ef4444,#f97316)}
.big{font-size:25px;font-weight:bold}
.stage{font-size:18px;color:#38bdf8}
.warn{color:#facc15}
.danger{color:#fb7185}
.small{color:#cbd5e1}
</style>
</head>
<body>
<div class="wrap">
<div class="card">
<h1>Laser Bull/Bear Seal Reader</h1>
<p class="small">Simulated reader until real market API is connected.</p>
<button onclick="toggleNotifications()">Enable / Disable Browser Notifications</button>
<p id="notifyStatus">Notifications: OFF</p>

<div class="row">
<input id="stockInput" placeholder="Search stock option ticker ex: SPY">
<button onclick="addTicker('stock')">Search Stock</button>
</div>

<div class="row">
<input id="cryptoInput" placeholder="Search alt coin ex: BTC">
<button onclick="addTicker('crypto')">Search Crypto</button>
</div>
</div>

<div class="card">
<h2>Searched Readers Ready For Final Seal Ping</h2>
<div id="readers"></div>
</div>
EOF

cat >> app.py <<'EOF'
<script>
let alerts=false;
let readers=[];

function toggleNotifications(){
  if(!("Notification" in window)){
    document.getElementById("notifyStatus").innerText="Notifications not supported";
    return;
  }

  if(Notification.permission==="granted"){
    alerts=!alerts;
    document.getElementById("notifyStatus").innerText="Notifications: "+(alerts?"ON":"OFF");
    return;
  }

  Notification.requestPermission().then(p=>{
    alerts = p==="granted";
    document.getElementById("notifyStatus").innerText="Notifications: "+(alerts?"ON":"OFF / BLOCKED");
  });
}

function addTicker(type){
  let input = type==="stock" ? document.getElementById("stockInput") : document.getElementById("cryptoInput");
  let symbol = input.value.trim().toUpperCase();
  if(!symbol) return;

  readers.push({
    symbol,
    type,
    pct:45,
    side:"BULL",
    sealed:false,
    lastStage:""
  });

  input.value="";
  render();
}
EOF

cat >> app.py <<'EOF'
function stageFor(p){
  if(p < 45){
    return {
      name:"WAITING FOR PREBIRTH",
      cls:"",
      speed:"",
      text:"Not enough pressure yet. Reader is watching for 45%."
    };
  }

  if(p >=45 && p <55){
    return {
      name:"PREBIRTH → BIRTH OF TREND",
      cls:"",
      speed:"medium",
      text:"45%-55%: bullish/bearish flip is forming. Laser is moving medium speed."
    };
  }

  if(p >=55 && p <60){
    return {
      name:"GALAXY HOLD TEST",
      cls:"warn",
      speed:"fast",
      text:"55%-60%: fakeout scan. Reader checks if the move can hold."
    };
  }

  return {
    name:"FINAL SEAL / POWER DOWN EXIT WATCH",
    cls:"danger",
    speed:"fast",
    text:"60% seal reached. Power down warning. Get out if signs show fakeout, whales, political/global event, or group sell pressure."
  };
}

function sealSound(){
  const ctx=new AudioContext();

  [180,260,120].forEach((freq,i)=>{
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value=freq;
    gain.gain.value=.08;
    osc.start(ctx.currentTime+i*.18);
    osc.stop(ctx.currentTime+i*.18+.16);
  });

  setTimeout(()=>ctx.close(),900);
}

function finalSealPing(r){
  sealSound();

  if(alerts && "Notification" in window && Notification.permission==="granted"){
    new Notification("FINAL SEAL PING: "+r.symbol,{
      body:r.side+" "+r.pct.toFixed(1)+"% — POWER DOWN / GET OUT WATCH"
    });
  }
}
EOF

cat >> app.py <<'EOF'
function updateData(){
  readers.forEach(r=>{
    if(r.sealed) return;

    let move = Math.random()*4.5;
    r.pct = Math.min(62, r.pct + move);

    if(Math.random()>.62){
      r.side = r.side==="BULL" ? "BEAR" : "BULL";
    }

    if(r.pct >= 60 && !r.sealed){
      r.sealed=true;
      finalSealPing(r);
    }
  });

  render();
}

function render(){
  let html="";

  if(readers.length===0){
    html="<p class='small'>Search a stock or crypto ticker to arm a reader.</p>";
  }

  readers.forEach((r,i)=>{
    const st=stageFor(r.pct);
    const bear = r.side==="BEAR" ? "bearfill" : "";
    const pressure = r.side==="BULL"
      ? "BUY PRESSURE OVERTAKING SELLERS"
      : "SELL PRESSURE OVERTAKING BUYERS";

    html += `
    <div class="reader ${st.speed}">
      <div class="laser"></div>
      <div class="big">Reader #${i+1}: ${r.symbol} (${r.type.toUpperCase()})</div>
      <div>${r.side} CONTROL: ${r.pct.toFixed(1)}%</div>
      <div class="meter"><div class="fill ${bear}" style="width:${r.pct}%"></div></div>
      <div class="stage ${st.cls}">${st.name}</div>
      <p>${pressure}</p>
      <p>${st.text}</p>
      <p class="small">${r.sealed ? "SEALED: Final ping already fired." : "Armed: final ping fires only at 60% power down stage."}</p>
    </div>`;
  });

  document.getElementById("readers").innerHTML=html;
}

setInterval(updateData,3000);
render();
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
EOF

git add .
git commit -m "final seal search reader"
git push --force origin main
cat > requirements.txt <<'EOF'
flask
gunicorn
requests
EOF

cat > app.py <<'EOF'
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
EOF

cat >> app.py <<'EOF'

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
EOF

cat >> app.py <<'EOF'

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
EOF

git add .
git commit -m "connect market api live seal reader"
git push --force origin main
pip install google-auth google-auth-oauthlib google-api-python-client requests
pip install --upgrade pip setuptools wheel
pkg install rust clang python-dev openssl-dev libffi-dev -y
pip install requests
pip install google-auth
pip install google-auth-oauthlib
pip install google-api-python-client
pip uninstall google-api-python-client google-auth google-auth-oauthlib cryptography -y
pip install requests flask
cat > merchant_feed.py <<'EOF'
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
EOF

python merchant_feed.py
