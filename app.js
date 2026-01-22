// TopoJSON (US states)
const TOPO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Türkçe adlar
const TR = {
  "Alabama":"Alabama","Alaska":"Alaska","Arizona":"Arizona","Arkansas":"Arkansas",
  "California":"Kaliforniya","Colorado":"Colorado","Connecticut":"Connecticut","Delaware":"Delaware",
  "Florida":"Florida","Georgia":"Georgia","Hawaii":"Hawaii","Idaho":"Idaho","Illinois":"Illinois",
  "Indiana":"Indiana","Iowa":"Iowa","Kansas":"Kansas","Kentucky":"Kentucky","Louisiana":"Louisiana",
  "Maine":"Maine","Maryland":"Maryland","Massachusetts":"Massachusetts","Michigan":"Michigan",
  "Minnesota":"Minnesota","Mississippi":"Mississippi","Missouri":"Missouri","Montana":"Montana",
  "Nebraska":"Nebraska","Nevada":"Nevada","New Hampshire":"New Hampshire","New Jersey":"New Jersey",
  "New Mexico":"Yeni Meksika","New York":"New York","North Carolina":"Kuzey Carolina",
  "North Dakota":"Kuzey Dakota","Ohio":"Ohio","Oklahoma":"Oklahoma","Oregon":"Oregon",
  "Pennsylvania":"Pennsylvania","Rhode Island":"Rhode Island","South Carolina":"Güney Carolina",
  "South Dakota":"Güney Dakota","Tennessee":"Tennessee","Texas":"Teksas","Utah":"Utah",
  "Vermont":"Vermont","Virginia":"Virginia","Washington":"Washington","West Virginia":"Batı Virginia",
  "Wisconsin":"Wisconsin","Wyoming":"Wyoming"
};

// FIPS -> English state name
const FIPS_TO_EN = {
  1:"Alabama",2:"Alaska",4:"Arizona",5:"Arkansas",6:"California",8:"Colorado",9:"Connecticut",
  10:"Delaware",12:"Florida",13:"Georgia",15:"Hawaii",16:"Idaho",17:"Illinois",18:"Indiana",
  19:"Iowa",20:"Kansas",21:"Kentucky",22:"Louisiana",23:"Maine",24:"Maryland",25:"Massachusetts",
  26:"Michigan",27:"Minnesota",28:"Mississippi",29:"Missouri",30:"Montana",31:"Nebraska",
  32:"Nevada",33:"New Hampshire",34:"New Jersey",35:"New Mexico",36:"New York",37:"North Carolina",
  38:"North Dakota",39:"Ohio",40:"Oklahoma",41:"Oregon",42:"Pennsylvania",44:"Rhode Island",
  45:"South Carolina",46:"South Dakota",47:"Tennessee",48:"Texas",49:"Utah",50:"Vermont",
  51:"Virginia",53:"Washington",54:"West Virginia",55:"Wisconsin",56:"Wyoming"
};

// DOM
const els = {
  q: document.getElementById("q"),

  color: document.getElementById("color"),
  width: document.getElementById("width"),
  alpha: document.getElementById("alpha"),

  widthVal: document.getElementById("widthVal"),
  alphaVal: document.getElementById("alphaVal"),

  previewPath: document.getElementById("previewPath"),
  previewText: document.getElementById("previewText"),

  dl: document.getElementById("dl"),
  reset: document.getElementById("reset"),
  msg: document.getElementById("msg"),

  // custom dropdown
  comboBtn: document.getElementById("comboBtn"),
  comboMenu: document.getElementById("comboMenu"),
  stateInput: document.getElementById("stateInput"),
  stateSearch: document.getElementById("stateSearch"),
  stateList: document.getElementById("stateList"),
};

let geoByEN = {};
let selectedEN = "Alabama";

function setMsg(text, type){
  els.msg.textContent = text || "";
  els.msg.className = "hint" + (type ? (" " + type) : "");
}

function escapeXml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&apos;");
}

function hexToKmlAABBGGRR(hex, alpha01){
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const a = Math.max(0, Math.min(1, Number(alpha01)));
  const aa = Math.round(a * 255);

  const to2 = (n)=> n.toString(16).padStart(2,"0");
  // KML: AABBGGRR
  return (to2(aa) + to2(b) + to2(g) + to2(r)).toLowerCase();
}

function coordsToKmlLinearRing(coords){
  return coords.map(p => `${p[0]},${p[1]},0`).join(" ");
}

function polygonToKmlPlacemark(nameTR, styleId, polygonCoords){
  const outer = polygonCoords[0];
  const holes = polygonCoords.slice(1);

  let innerXml = "";
  for(const hole of holes){
    innerXml += `
      <innerBoundaryIs>
        <LinearRing><coordinates>${coordsToKmlLinearRing(hole)}</coordinates></LinearRing>
      </innerBoundaryIs>`;
  }

  return `
  <Placemark>
    <name>${escapeXml(nameTR)}</name>
    <styleUrl>#${styleId}</styleUrl>
    <Polygon>
      <tessellate>1</tessellate>
      <outerBoundaryIs>
        <LinearRing><coordinates>${coordsToKmlLinearRing(outer)}</coordinates></LinearRing>
      </outerBoundaryIs>
      ${innerXml}
    </Polygon>
  </Placemark>`;
}

function multiPolygonToSinglePlacemark(nameTR, styleId, multiPolyCoords){
  const polygonsXml = multiPolyCoords.map(polygonCoords => {
    const outer = polygonCoords[0];
    const holes = polygonCoords.slice(1);

    let innerXml = "";
    for(const hole of holes){
      innerXml += `
        <innerBoundaryIs>
          <LinearRing><coordinates>${coordsToKmlLinearRing(hole)}</coordinates></LinearRing>
        </innerBoundaryIs>`;
    }

    return `
      <Polygon>
        <tessellate>1</tessellate>
        <outerBoundaryIs>
          <LinearRing><coordinates>${coordsToKmlLinearRing(outer)}</coordinates></LinearRing>
        </outerBoundaryIs>
        ${innerXml}
      </Polygon>`;
  }).join("\n");

  return `
  <Placemark>
    <name>${escapeXml(nameTR)}</name>
    <styleUrl>#${styleId}</styleUrl>
    <MultiGeometry>
      ${polygonsXml}
    </MultiGeometry>
  </Placemark>`;
}

function featureToKml(nameTR, feature, lineColorKml, width){
  const styleId = "s1";
  const w = Math.max(1, Math.min(50, Number(width)||4));

  const styles = `
  <Style id="${styleId}">
    <LineStyle>
      <color>${lineColorKml}</color>
      <width>${w}</width>
    </LineStyle>
    <PolyStyle>
      <fill>0</fill>
      <outline>1</outline>
    </PolyStyle>
  </Style>`;

  const geom = feature.geometry;
  let placemarks = "";

  if(geom.type === "Polygon"){
    placemarks = polygonToKmlPlacemark(nameTR, styleId, geom.coordinates);
  } else if(geom.type === "MultiPolygon"){
    placemarks = multiPolygonToSinglePlacemark(nameTR, styleId, geom.coordinates);
  } else {
    throw new Error("Desteklenmeyen geometri: " + geom.type);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escapeXml(nameTR)} - border</name>
  ${styles}
  ${placemarks}
</Document>
</kml>`;
}

function downloadText(filename, text){
  const blob = new Blob([text], {type:"application/vnd.google-earth.kml+xml"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

// ----- UI -----
function syncPreview(){
  // sayılar
  if(els.widthVal) els.widthVal.textContent = els.width.value;
  if(els.alphaVal) els.alphaVal.textContent = els.alpha.value;

  const a01 = Number(els.alpha.value) / 100;

  // preview çizgisi
  if(els.previewPath){
    els.previewPath.setAttribute("stroke", els.color.value);
    els.previewPath.setAttribute("stroke-width", String(els.width.value));
    els.previewPath.setAttribute("stroke-opacity", String(a01));
  }

  // preview text
  if(els.previewText){
    els.previewText.textContent = `${els.color.value} • ${els.width.value}px • ${els.alpha.value}%`;
  }
}

function openMenu(){
  els.comboMenu.classList.add("open");
  els.stateSearch.value = "";
  els.stateSearch.focus();
  renderStateList();
}
function closeMenu(){
  els.comboMenu.classList.remove("open");
}

function setSelected(en){
  selectedEN = en;
  els.stateInput.textContent = TR[en] || en;
  renderStateList();
  closeMenu();
}

function renderStateList(){
  const qGlobal = (els.q.value || "").trim().toLowerCase();
  const qLocal = (els.stateSearch.value || "").trim().toLowerCase();
  const q = qLocal || qGlobal;

  const items = Object.values(FIPS_TO_EN)
    .map(en => ({en, tr: TR[en] || en}))
    .sort((a,b)=> a.tr.localeCompare(b.tr, "tr"))
    .filter(x => !q || x.tr.toLowerCase().includes(q) || x.en.toLowerCase().includes(q));

  els.stateList.innerHTML = items.map(x => {
    const cls = (x.en === selectedEN) ? "item active" : "item";
    return `<div class="${cls}" data-en="${x.en}">${x.tr}</div>`;
  }).join("");

  // click
  els.stateList.querySelectorAll("[data-en]").forEach(el=>{
    el.addEventListener("click", ()=> setSelected(el.getAttribute("data-en")));
  });
}

// ----- MAIN -----
async function init(){
  setMsg("Veri yükleniyor…");

  const res = await fetch(TOPO_URL);
  const topo = await res.json();

  const geo = topojson.feature(topo, topo.objects.states);
  for(const f of geo.features){
    const en = FIPS_TO_EN[Number(f.id)];
    if(en) geoByEN[en] = f;
  }

  // default
  setSelected("Alabama");
  syncPreview();
  setMsg("Hazır.", "ok");
}

function wireEvents(){
  // preview updates
  els.color.addEventListener("input", syncPreview);
  els.width.addEventListener("input", syncPreview);
  els.alpha.addEventListener("input", syncPreview);

  // dropdown
  els.comboBtn.addEventListener("click", ()=>{
    if(els.comboMenu.classList.contains("open")) closeMenu();
    else openMenu();
  });
  els.stateSearch.addEventListener("input", renderStateList);

  // dışarı tıkla kapat
  document.addEventListener("click", (e)=>{
    const inside = e.target.closest("#combo");
    if(!inside) closeMenu();
  });

  // global search filters list
  els.q.addEventListener("input", renderStateList);

  // reset
  els.reset.addEventListener("click", ()=>{
    els.q.value = "";
    els.color.value = "#ffffff";
    els.width.value = 4;
    els.alpha.value = 100;
    setSelected("Alabama");
    syncPreview();
    setMsg("", "");
  });

  // download
  els.dl.addEventListener("click", ()=>{
    try{
      const en = selectedEN;
      const f = geoByEN[en];
      if(!f){
        setMsg("Eyalet verisi bulunamadı.", "err");
        return;
      }

      const trName = TR[en] || en;
      const alpha01 = Number(els.alpha.value) / 100;
      const kmlColor = hexToKmlAABBGGRR(els.color.value, alpha01);
      const width = els.width.value;

      const kml = featureToKml(trName, f, kmlColor, width);
      downloadText(`${trName}_border.kml`, kml);
      setMsg("KML indirildi.", "ok");
    } catch(e){
      console.error(e);
      setMsg("Hata: " + (e?.message || e), "err");
    }
  });
}

// start
wireEvents();
init().catch(e=>{
  console.error(e);
  setMsg("Yükleme hatası: " + (e?.message || e), "err");
});
