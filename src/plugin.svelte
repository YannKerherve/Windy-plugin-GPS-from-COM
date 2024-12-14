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
    <div class="button" on:click={connectSerial}>Connect to GPS</div>
    {#if gpsData}
           <p> GPS Data:</p>
           <p>  Latitude: {latitude}° </p>
           <p>  Longitude: {longitude}° </p>
           <p> A programme by < a href="https://github.com/YannKerherve" > Yann Kerhervé </a>. Contact me for more information or questions.< /a > </p>

       
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
    let error: string | null = null;

    // Stockage du port série pour nettoyage éventuel
    let port: SerialPort | null = null;
    let reader: ReadableStreamDefaultReader | null = null;

    // Fonction pour se connecter au port série
    async function connectSerial() {
        error = null; // Réinitialiser l'erreur à chaque tentative
        try {
            // Demande à l'utilisateur de sélectionner un port série
            port = await navigator.serial.requestPort();
            // Ouvrir la connexion avec le port sélectionné
            await port.open({ baudRate: 115200 });

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
        const regex = /\$GNRMC,\d+.\d+,[AV],(\d{2})(\d{2}.\d+),([NS]),(\d{3})(\d{2}.\d+),([EW])/;
        const match = regex.exec(data);

        if (match) {
            // Conversion des coordonnées en format décimal
            const latDeg = parseFloat(match[1]);
            const latMin = parseFloat(match[2]);
            const latHem = match[3];
            const lonDeg = parseFloat(match[4]);
            const lonMin = parseFloat(match[5]);
            const lonHem = match[6];

            latitude = ((latDeg + latMin / 60) * (latHem === 'S' ? -1 : 1)).toFixed(6);
            longitude = ((lonDeg + lonMin / 60) * (lonHem === 'E' ? -1 : 1)).toFixed(6);
if (latitude && longitude) {
    addMarkerOnMap(parseFloat(latitude), parseFloat(longitude));
}
        }
    }
function addMarkerOnMap(lat: latitude, lon: longitude) {
  if (map) {
    // Crée le marqueur avec la popup contenant une icône qui tourne
    const marker = L.marker([lat, lon]).addTo(map)
        .bindPopup(
            `<div style="display: flex; align-items: center;">
                <i class="fa-solid fa-location-crosshairs" style="font-size: 24px; animation: spin 2s linear infinite;"></i>
                <span style="margin-left: 10px;">Position: ${lat.toFixed(6)}, ${lon.toFixed(6)}</span>
            </div>`
        );

   
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
