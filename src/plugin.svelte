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
<center>🛳️</center>

<p> Frame: $GNRMC ; 
<label for="baudrate">Baud Rate:</label>
<select name="baurate" id="baudrate">
  <option value="115200">115200</option>
  <option value="74880">74880</option>
  <option value="57600">57600</option>
  <option value="38400">38400</option>
  <option value="19200">19200</option>
  <option value="9600">9600</option>
</select>    </p>
<div class="button" on:click={connectSerial}>Connect to GPS</div>
<div class="button" on:click={deco}>Disconnect</div>  
    {#if gpsData}
           <p> GPS Data:</p>
           <p>  Latitude: {latitude}° </p>
           <p>  Longitude: {longitude}° </p>
           <p>  Sog: {cog} knt</p>
          <p>  Cog: {sog}°</p>
          <p>  Mag. Deviation: {dev}° {dir}</p>
    {/if}
    {#if error}
        <div class="error">
            <p>Error: {error}</p>
        </div>
    {/if}
</section>

<script lang="ts">
    import bcast from "@windy/broadcast";
    import { onDestroy, onMount } from 'svelte';
    import { map } from "@windy/map";
    // Configuration
    const title = 'GPS Position Plugin';

    // Variables pour stocker les données GPS et erreurs
    let gpsData: string | null = null;
    let latitude: string | null = null;
    let longitude: string | null = null;
    let cog: string | null = null;
    let sog: string | null = null;
    let dev: string | null = null;
    let dir: string | null = null;
    let error: string | null = null;
    let markerLayer = L.layerGroup().addTo(map);
    // Stockage du port série pour nettoyage éventuel
    let port: SerialPort | null = null;
    let reader: ReadableStreamDefaultReader | null = null;
    async function deco() {history.go(0);}

    // Fonction pour se connecter au port série
    async function connectSerial() {
        error = null; // Réinitialiser l'erreur à chaque tentative
        try {
            // Demande à l'utilisateur de sélectionner un port série
            port = await navigator.serial.requestPort();
            // Ouvrir la connexion avec le port sélectionné
            const baudSelect = document.getElementById('baudrate'); // Sélectionne l'élément <select> par son ID
            const baudRate = baudSelect.value;
            await port.open({ baudRate: parseInt(baudRate) });

            reader = port.readable.getReader();

            // Lire les données du port série en continu
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    console.log('Lecture terminée');
                    break; // Quitter si la lecture est terminée
                }

                // Convertir les données en texte
                const text = new TextDecoder().decode(value);
                parseGPSData(text);
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

    // Fonction pour analyser les trames GPS et extraire la position
    function parseGPSData(data: string) {
        gpsData = data;

        // Extrait la latitude et la longitude d'une trame NMEA (GNRMC)
        const regex = /\$GPRMC,(\d{6}\.\d+),([AV]),(\d{2})(\d{2}\.\d+),([NS]),(\d{3})(\d{2}\.\d+),([EW]),(\d+\.\d+)?,(\d+\.\d+)?,(\d{6}),(-?\d+\.\d+)?,([EW])?,([ADEMSN])?\*/;
        const match = regex.exec(data);

        if (match) {
            // Conversion des coordonnées en format décimal
            const latDeg = parseFloat(match[3]);
            const latMin = parseFloat(match[4]);
            const latHem = match[5];
            const lonDeg = parseFloat(match[6]);
            const lonMin = parseFloat(match[7]);
            const lonHem = match[8];
            cog = match[9];
            sog = match[10];
            dev = match[12];
            dir = match[13];


            latitude = ((latDeg + latMin / 60) * (latHem === 'S' ? -1 : 1)).toFixed(6);
            longitude = ((lonDeg + lonMin / 60) * (lonHem === 'E' ? -1 : 1)).toFixed(6);
if (latitude && longitude) {
    addMarkerOnMap(parseFloat(latitude), parseFloat(longitude));
}
        }
    }
function addMarkerOnMap(lat, lon) {
    if (map) {
markerLayer.clearLayers();
        // Crée le marqueur avec la popup contenant une icône qui tourne

                const customIcon = L.divIcon({
            className: 'custom-marker', // Classe CSS pour styliser
            html: `
                <div style="display: flex; align-items: center; flex-direction: column;">
                    <div style="font-size: 24px; animation: spin 2s linear infinite; color: black;">
                        <i class="fa-solid fa-location-crosshairs"></i>
                    </div>
                    </div>
            `,
            iconSize: [30, 42], // Taille approximative
            iconAnchor: [15, 42], // Ancre pour alignement (base du marqueur)
        });

        // Ajoute le marqueur à la carte
        //const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(markerLayer);   
} else {
        console.error("Carte Windy non disponible !");
    }
}

    export const onopen = (_params: unknown) => {
        // Votre plugin a été ouvert avec des paramètres
    };

    onMount(() => {
        // Votre plugin a été monté
        window.addEventListener('beforeunload', cleanup);
    });

    onDestroy(() => {
        // Votre plugin a été détruit, nettoyage
        cleanup();
        window.removeEventListener('beforeunload', cleanup);
    });
</script>

<style lang="less">
    .gps-info {
        margin-top: 20px;
        background-color: #f0f0f0;
        padding: 10px;
        border-radius: 5px;
    }

    .error {
        color: red;
        margin-top: 20px;
    }
</style>

