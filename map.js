// ---------------- 1. INITIALIZE MAP ----------------
var map = L.map('map', {
    center: [38.49359116114401, -98.45286764056368],
    zoom: 7,
    preferCanvas: false
});

// ---------------- 2. BASEMAP ----------------
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO &copy; OpenStreetMap',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// ---------------- 3. COLOR SCALE ----------------
function getColor(ratio) {
    if (ratio === null || ratio === undefined) return '#f8f8f6';
    return ratio > 2.0  ? '#800026' :
           ratio > 1.5  ? '#BD0026' :
           ratio > 1.2  ? '#E31A1C' :
           ratio > 1.0  ? '#FC4E2A' :
           ratio >= 0.8 ? '#a2e9f4' :
           ratio >= 0.5 ? '#6a4cfe' :
                          '#2e05f8';
}

// ---------------- 4. TB CALCULATIONS ----------------
function getTotalTB(p){ return p.sum_F65__ON_SITE_RELEASE_TOTAL && p.B03002_001E ? (p.sum_F65__ON_SITE_RELEASE_TOTAL*p.B03002_001E)/2937569 : null; }
function getBlackTB(p){ return p.sum_F65__ON_SITE_RELEASE_TOTAL && p.B03002_004E ? (p.sum_F65__ON_SITE_RELEASE_TOTAL*p.B03002_004E)/154704 : null; }
function getWhiteTB(p){ return p.sum_F65__ON_SITE_RELEASE_TOTAL && p.B03002_003E ? (p.sum_F65__ON_SITE_RELEASE_TOTAL*p.B03002_003E)/2155363 : null; }
function getPovertyTB(p){ return p.sum_F65__ON_SITE_RELEASE_TOTAL && p.B17020_002E ? (p.sum_F65__ON_SITE_RELEASE_TOTAL*p.B17020_002E)/328475 : null; }

// ---------------- 5. RATIO FUNCTIONS ----------------
var currentMetricName = "Black / White TB Ratio";
var currentRatioFunction = getBlackVsWhite;

function getBlackVsWhite(p){ let b=getBlackTB(p), w=getWhiteTB(p); return (b && w) ? b/w : null; }
function getWhiteShare(p){ let t=getTotalTB(p), w=getWhiteTB(p); return (t && w) ? w/t : null; }
function getBlackShare(p){ let t=getTotalTB(p), b=getBlackTB(p); return (t && b) ? b/t : null; }
function getPovertyShare(p){ let t=getTotalTB(p), pv=getPovertyTB(p); return (t && pv) ? pv/t : null; }

// ---------------- 6. STYLE FACTORY ----------------
function styleByRatio(ratioFunction){
    return function(feature){
        let ratio = ratioFunction(feature.properties);
        return {
            fillColor: getColor(ratio),
            weight: 0.5,
            opacity: 1,
            color: 'gray',
            fillOpacity: 0.8
        };
    }
}

// ---------------- 7. INTERACTION ----------------
function highlightFeature(e){
    var layer = e.target;
    layer.setStyle({ weight: 3, color:'#000', fillOpacity:0.9 });
    layer.bringToFront();
    info.update(layer.feature.properties);
}

function resetHighlight(e){ geojsonLayers[currentMetricName].resetStyle(e.target); info.update(); }
function zoomToFeature(e){ map.fitBounds(e.target.getBounds()); }

function onEachFeature(feature, layer){
    layer.on({ mouseover:highlightFeature, mouseout:resetHighlight, click:zoomToFeature });
}

// ---------------- 8. CREATE LAYERS ----------------
var geojsonLayers = {};

geojsonLayers["Black / White TB Ratio"] = L.geoJSON(Toxic_Burden,{ style:styleByRatio(getBlackVsWhite), onEachFeature:onEachFeature, smoothFactor: 0 });
geojsonLayers["White Share of Total TB"] = L.geoJSON(Toxic_Burden,{ style:styleByRatio(getWhiteShare), onEachFeature:onEachFeature, smoothFactor: 0 });
geojsonLayers["Black Share of Total TB"] = L.geoJSON(Toxic_Burden,{ style:styleByRatio(getBlackShare), onEachFeature:onEachFeature, smoothFactor: 0 });
geojsonLayers["Poverty Share of Total TB"] = L.geoJSON(Toxic_Burden,{ style:styleByRatio(getPovertyShare), onEachFeature:onEachFeature, smoothFactor: 0 });

// Add default
geojsonLayers[currentMetricName].addTo(map);

// ---------------- 9. INFO PANEL ----------------
var info = L.control({position:'bottomleft'});

info.onAdd = function(){
    this._div = L.DomUtil.create('div','info');
    this.update();
    return this._div;
};

info.update = function(props){
    let ratio = props ? currentRatioFunction(props) : null;
    this._div.innerHTML = `<h4>${currentMetricName}</h4>` + (props ?
        `<b>County Name: </b> ${props.County?.toLocaleString() ?? 'N/A'}<br>
         <b>Census Tract #:</b> ${props.NAME?.toLocaleString() ?? 'N/A'}<br>
         <b>Value:</b> ${ratio ? ratio.toFixed(2) : 'N/A'}<br>`
         : 'Hover over a tract');
};
info.addTo(map);

// ---------------- 10. LEGEND ----------------
var legend = L.control({position:'bottomright'});
legend.onAdd = function(){
    var div = L.DomUtil.create('div','info legend');
    var grades=[0,0.5,0.8,1.0,1.2,1.5,2.0];
    div.innerHTML=`<strong>${currentMetricName}</strong><br>`;
    for(let i=0;i<grades.length;i++){
        div.innerHTML+=`<i style="background:${getColor(grades[i]+0.01)}"></i>
        ${grades[i]}${grades[i+1]?`–${grades[i+1]}<br>`:'+'}`;
    }
    return div;
};
legend.addTo(map);

// ---------------- 11. LAYER CONTROL ----------------
L.control.layers(null, geojsonLayers, {collapsed:false}).addTo(map);

// ---------------- 12. UPDATE WHEN LAYER CHANGES ----------------
map.on('overlayadd', function(e){
    currentMetricName = e.name;
    currentRatioFunction =
        e.name.includes("White Share") ? getWhiteShare :
        e.name.includes("Black Share") ? getBlackShare :
        e.name.includes("Poverty") ? getPovertyShare :
        getBlackVsWhite;

    legend.remove();
    legend.addTo(map);
    info.update();
});
