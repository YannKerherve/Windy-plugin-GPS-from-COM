<div class="plugin__mobile-header">
    { title }
</div>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">

<section class="plugin__content">
    <div
        class="plugin__title plugin__title--chevron-back"
        on:click={ () => bcast.emit('rqstOpen', 'menu') }
    >
    { title }
    </div>
<p> A plugin by <a href="https://github.com/YannKerherve">Yann Kerhervé</a></p>
<p> <center>🛳️</center></p>

<p><label for="baudrate">Baud Rate:</label>
<select name="baurate" id="baudrate">
  <option value="115200">115200</option>
  <option value="74880">74880</option>
  <option value="57600">57600</option>
  <option value="38400">38400</option>
  <option value="19200">19200</option>
  <option value="9600">9600</option>
  <option value="4800">4800</option>
</select>    </p>
<div class="button" on:click={connectSerial}>Connect to GPS</div>
<div class="button" on:click={deco}>Disconnect</div>
    {#if gpsState.lat && gpsState.lon}
           <p> GPS Data:</p>
           <p>  Latitude: {gpsState.lat.toFixed(5)}° </p>
           <p>  Longitude: {gpsState.lon.toFixed(5)}° </p>
           <p>  Sog: {gpsState.sog ?? 'N/A'} knt</p>
          <p>  Cog: {gpsState.cog ?? 'N/A'}°</p>
<div class="button" on:click={centerMap(windyMap)}>Refocus ship</div>
<div class="button" on:click={followship}>Follow ship</div>
    {/if}



 </section>

<script lang="ts">
    import bcast from "@windy/broadcast";
    import { onDestroy, onMount } from 'svelte';
    import { map } from "@windy/map";
    // Configuration
    const title = 'GPS Position Plugin';
let error = null;
let port = null;
let lineBuffer ='';
let reader = null;
let lastLat = null;
let lastLon = null;
let follow = 0;
    let gpsState = {
    lat: null,
    lon: null,
    cog: null,
    sog: null,
    courseVector: null,
    trace: [],
    following: false,
};

let windyMap;
let tracePolyline = null;

    async function connectSerial() {
        error = null; // Réinitialiser l'erreur à chaque tentative
        try {
            // Demande à l'utilisateur de sélectionner un port série
            port = await navigator.serial.requestPort();
            // Ouvrir la connexion avec le port sélectionné
            const baudSelect = document.getElementById('baudrate'); // Sélectionne l'élément <select> par son ID
            const baudRate = baudSelect.value;
            await port.open({ baudRate: parseInt(baudRate) });

const decoder = new TextDecoderStream();
const inputDone = port.readable.pipeTo(decoder.writable);
const inputStream = decoder.readable;

const reader = inputStream.getReader();

lineBuffer = '';
while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    lineBuffer += value;
    let newlineIndex;
    while ((newlineIndex = lineBuffer.indexOf('\n')) >= 0) {
        const line = lineBuffer.slice(0, newlineIndex).trim();
        lineBuffer = lineBuffer.slice(newlineIndex + 1);

        if (line.startsWith('$')) {
            console.log('Trame complète :', line);
            parseNMEASentence(line);
            drawTrace(windyMap);
            drawBoatMarker(windyMap);
            updateMapPosition(windyMap);
            if (follow==1) {
                centerMap(windyMap);
            }
        }
    }
}





        } catch (err) {
            error = `Erreur de connexion: ${err.message || err}`;
            console.error('Erreur de connexion au port COM:', err);
        } finally {
            // Nettoyage du lecteur et du port en cas d'erreur ou de fermeture
            cleanup();
        }
    }

    // Fonction pour nettoyer correctement les ressources
    async function cleanup() {
        if (reader) {
            try {
                await reader.cancel();
            } catch (err) {
                console.warn('Erreur lors de la fermeture du lecteur:', err);
            }
        }
        if (port) {
            try {
                await port.close();
            } catch (err) {
                console.warn('Erreur lors de la fermeture du port:', err);
            }
        }
    }
async function deco() {history.go(0);}


function parseLat(val, dir) {
    const d = parseInt(val.slice(0, 2), 10);
    const m = parseFloat(val.slice(2));
    let lat = d + m / 60;
    if (dir === 'S') lat *= -1;
    return lat;
}

function parseLon(val, dir) {
    const d = parseInt(val.slice(0, 3), 10);
    const m = parseFloat(val.slice(3));
    let lon = d + m / 60;
    if (dir === 'W') lon *= -1;
    return lon;
}

function centerMap(map){map.setView([gpsState.lat, gpsState.lon]);}

function parseNMEASentence(sentence) {
    const parts = sentence.split(',');
    if (sentence.startsWith('$GPRMC') || sentence.startsWith('$GNRMC')) {
        if (parts[2] === 'A') {
            gpsState.lat = parseLat(parts[3], parts[4]);
            gpsState.lon = parseLon(parts[5], parts[6]);
            gpsState.sog = parseFloat(parts[7]);
            gpsState.cog = parseFloat(parts[8]);
        }
    } else if (sentence.startsWith('$GPGLL')) {
        gpsState.lat = parseLat(parts[1], parts[2]);
        gpsState.lon = parseLon(parts[3], parts[4]);
    } else if (sentence.startsWith('$GPGGA')) {
        gpsState.lat = parseLat(parts[2], parts[3]);
        gpsState.lon = parseLon(parts[4], parts[5]);
    } else if (sentence.startsWith('$GPVTG')) {
        gpsState.cog = parseFloat(parts[3]);
        gpsState.sog = parseFloat(parts[7]);
    }
if (gpsState.lat && gpsState.lon) {
    if (!gpsState.cog || isNaN(gpsState.cog)) {
        if (lastLat !== null && lastLon !== null) {
            gpsState.cog = computeCOG(lastLat, lastLon, gpsState.lat, gpsState.lon);
        }
    }
    lastLat = gpsState.lat;
    lastLon = gpsState.lon;
}
}


function computeCOG(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);

    const y = Math.sin(dLon) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon);
    let brng = Math.atan2(y, x);
    brng = toDeg(brng);
    return (brng + 360) % 360; // Normalisation entre 0 et 360°
}













let boatMarker = null;
function drawBoatMarker(map) {
    if (!gpsState.lat || !gpsState.lon || isNaN(gpsState.cog)) return;

    const position = L.latLng(gpsState.lat, gpsState.lon);
    const course = gpsState.cog; // cog = course over ground

    const icon = L.divIcon({
        className: '',
        html: `
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100" style="transform: rotate(${course}deg);">
                <polygon points="50,0 90,100 50,80 10,100" fill="red" stroke="black" stroke-width="3"/>
            </svg>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20] // Centre de rotation
    });

    if (!boatMarker) {
        boatMarker = L.marker(position, { icon }).addTo(map);
    } else {
        boatMarker.setLatLng(position);
        boatMarker.setIcon(icon);
    }
}

function followship(){
    if (follow==1){
        follow=0
    }
    else{
        follow=1
        }
}


function drawTrace(map) {
    if (!gpsState.lat || !gpsState.lon) return;
    const newPoint = [gpsState.lat, gpsState.lon];
    gpsState.trace.push(newPoint);
    if (!tracePolyline) {
        tracePolyline = L.polyline(gpsState.trace, { color: 'blue' }).addTo(map);
    } else {
        tracePolyline.setLatLngs(gpsState.trace);
    }
}

function drawCourseVector(map) {
    if (!gpsState.lat || !gpsState.lon || !gpsState.cog) return;
    const lengthNm = 0.1;
    const lengthDeg = lengthNm / 60;
    const angleRad = (gpsState.cog * Math.PI) / 180;
    const destLat = gpsState.lat + lengthDeg * Math.cos(angleRad);
    const destLon = gpsState.lon + lengthDeg * Math.sin(angleRad);
    if (gpsState.courseVector) map.removeLayer(gpsState.courseVector);
    gpsState.courseVector = L.polyline([
        [gpsState.lat, gpsState.lon],
        [destLat, destLon]
    ], { color: 'red', weight: 2 }).addTo(map);
}

function updateMapPosition(map) {
    if (gpsState.following && gpsState.lat && gpsState.lon) {
        map.panTo([gpsState.lat, gpsState.lon]);
    }
}

function createButtons(map) {
    const recenterBtn = L.control({ position: 'topleft' });
    recenterBtn.onAdd = function () {
        const btn = L.DomUtil.create('button', 'recenter-btn');
        btn.innerText = 'Recenter';
        btn.onclick = () => {
            if (gpsState.lat && gpsState.lon) {
                map.setView([gpsState.lat, gpsState.lon]);
            }
        };
        return btn;
    };
    recenterBtn.addTo(map);

    const followBtn = L.control({ position: 'topleft' });
    followBtn.onAdd = function () {
        const btn = L.DomUtil.create('button', 'follow-btn');
        btn.innerText = 'Follow Boat';
        btn.onclick = () => {
            gpsState.following = !gpsState.following;
            btn.innerText = gpsState.following ? 'Unfollow Boat' : 'Follow Boat';
        };
        return btn;
    };
    followBtn.addTo(map);
}

function onSerialData(line, map) {
    parseNMEASentence(line);
    if (gpsState.lat && gpsState.lon) {
        drawTrace(map);
        drawCourseVector(map);
        updateMapPosition(map);
    }
}

async function setupSerial(map) {
    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 4800 });
        const reader = port.readable.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            lines.forEach(line => onSerialData(line.trim(), map));
        }
    } catch (err) {
        console.error('Serial error:', err);
    }
}

onMount(() => {
window.addEventListener('beforeunload', cleanup);
windyMap = map;
createButtons(windyMap);
});

onDestroy (() => {
cleanup();
window.removeEventListener('beforeunload', cleanup);
});
</script>

<style>
button.recenter-btn,
button.follow-btn {
    background-color: white;
    border: 1px solid #ccc;
    padding: 5px;
    margin: 5px;
    cursor: pointer;
}
</style>

<div id="windy"></div>


