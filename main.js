//// Modul Importe
const log = require('electron-log/main'); //log file modul - logged auf Console und %USER%\AppData\Roaming\Name der App\logs
const path = require('path'); // pfad modul
const fs = require('node:fs');// filesystem modul
///const npc = require('node-clipboardy');
const axios = require('axios');//http modul
require('dotenv').config();// modul zur Ermittlung der env Variablen liest die datei .env im Hauptverzeichnis und fügt diese Variablen ein
let myconfig = require('./config.json');//lese die app configuration
const clipboardListener = require ('clipboard-event');//modul zum Überwachen der Zwischenablage
Tail = require('tail').Tail;//Modul zur Überwachung der log Dateien
const { app, BrowserWindow, clipboard, ipcMain } = require('electron');// referenz auf die Electron Module app ( die Anwendungsschicht), BrowserWindow (als Chromium Referenz), ipcMain (als Komminikation zum Renderer Prozess)
var crypto = require("crypto-js");// zur Verschlüsselten Speicherung des Refresh Token
///const { AsyncResource } = require('async_hooks');
const sharp = require('sharp');


// definiere Globale Variablen
let lauf = 0; // Laufzeit für die Gültigkeit des Access Tokens - wenn kurz for Ablauf bitte an der API erneuern lassen
const access_token_time = 800 // per aktueller Definition ist die Gültigkeit des Accesstokens 15 Minuten oder 900 sec. danach muss er mit dem Refresh Token erneuert werden
let auth_token ="";// Zwischenspeicher für den accesstoken - flüchtig mit Programm ende
let refr_token ="";// gleiche für den refresh token
let success_token = false;//dient als Merker für den erfolgreichen Loginalgorithmus
const log_log = '\\RSILauncher\\log.log'; // suche hier nach der log datei
const game_log = '\\Game.log'; // Dateiname für Gamelog Datei
const my_access_url = config.url+"api/token/refresh/";
const my_refresh_url = config.url+"api/token/";
const my_register_url = config.url+"api/register/";
const my_reset_url = config.url+"api/reset/";
let log_path = '';
let prog_path = '';
let my_game_handle ='';


// Loginalgorithmus
// Ist kein Token in der Datei config.json gespeichert dann rendere login request 
// sonst lese den refresh Token und entschlüssele Ihn - danach Anfrage ans Backend zur Erneuerung des AccessTokens ( Der RefreshToken ist 90 Tage gültig)
// wenn ein status 200 ( Erfolg) in der Antwort ist, dann speichere der AccessToken und beginne mit der App
// wenn Fehler dann rendere Login Page Token ist abgelaufen oder hat einen Blacklist bekommen
// Nach dem erfolgreichen Loggin ist die Antwort der Backend API ein Objekt mit einem neuen Reresh und einem Access Token.
// Verschlüssele und speichere den Neuen Token in der config.json
// Starte einen Refresh timer von 800 sec zur Erneuerung des accessTokens
// der verschlüsselte Refresh Token in der config Datei ist u.a. mit dem Userhandle als Key bearbeitet



// Funktionsdefinitionen

//funktion zum verschlüsseln, entschlüsseln und speichern des Refresh Tokens
function get_token(r1,r2,mytoken,r0){ //r1,r2 sind die Schlüssel, mytoken der aktuelle token -> verschl Token bei lesen, und r0 = 0 für lesen und <>1 für schreiben
    function myencrypt(myt){//Verschlüsselungsfunktion
        const result = crypto.AES.encrypt(myt, r1+my_game_handle);//Anweisung zum Verschlüsseln
        return result.toString();// Ergebnis zurück
    };
    function mydecrypt(myt){//Enschlüsselung
        const result = crypto.AES.decrypt(myt, r1+my_game_handle);//Anweisung zum Entschlüsseln
        return result.toString(crypto.enc.Utf8);//rückgabe des Tokens
    };
    if (r0 === 1){// Heir startet die Funktion Abfrage 1 = Verschlüsseln sonst weiter bei entschlüsseln
        myconfig.token = myencrypt (mytoken);//Funktionsaufruf 
        fs.writeFileSync('./config.json', JSON.stringify(myconfig,null,2));//speichern in Datei
    } else {// sonst entschlüsseln
        return mydecrypt (myconfig.token);//Rückgabe direkt aus config
    };
};

//initialisiere die logging Funktion
function init_log(){
    log.initialize();
    if (myconfig.node_env === 'production'){//steht Produktion in der Config dann keine ausgabe auf der Konsole 
        log.transports.console.level = false;
        log.transports.file.level = myconfig.level_prod;// login Level wie in Config Datei einstellen
    } else {// ne ich bin noch in der Entwicklung oder Fehlersuche
        log.transports.console.level = myconfig.level;//Level aus Config für Konsole
        log.transports.file.level = myconfig.level;//Level für File aus Config
    };
    if (myconfig.debug !== 'true'){// Ich möchte login komplett abstellen somit alles flase
        log.transports.file.level = false;
        log.transports.console.level = false;
    };
};

//Funktion zur Erzeugung einer FensterKlasse
function createMainWindow(){
    const mainWindow = new BrowserWindow({//vererbt von Chomium
        width: 500,//Fenstebreite
        height:350,//Fensterhöhe
        frame: false,//Rahmenlos
        transparent: true,//transparent
        resizeable : true,//zoombar
        alwaysOnTop: true,//immer im Vordergrund
        webPreferences:{//Verhalten in die Welt ( aus diversen Gründen wird die App mit vollem Computerzugriff vom Renderer Prozess abgekapselt)
            preload: path.join(__dirname,'preload.js'),// keinen Direkten Aussenweltkontakt - dieser erfolgt über eine Kontextbrücke ( Sicherheitsrelevant)
            contextIsolation: true,//auch der Kontext an sich ist nicht für die Aussenwelt verfügbar
        }
    });
    if (success_token){// wurde der Loginprozess erfolgreich abgeschlossen ?
        mainWindow.loadFile(path.join(__dirname,'./renderer/main.html'));//ja weiter mit der App
    } else {//nein
        mainWindow.loadFile(path.join(__dirname,'./renderer/index.html'));//somit bitte Login renderen
    };
    return mainWindow;
}

//Funktion zur Ermittlung des Installationsverzeichnisses von Star Citizen 
function getthelogs() {
    return new Promise(function(resolve,reject){ // da JS asynchron abläuft müssen wir hier die Abarbeitung abwarten mit einem Promise
        fs.readFile(log_path+log_log, 'utf8',(err,mzdata) => {//lies die Datei ein und gib den Inhalt zurück
            if (err){// haben wir einen Fehler?
                reject(err);//erzeuge einen Fehler
                log.info('shit happens didnt read the file: log.log');// logge den Fehler
            } else{// nope alles gut weiter im Text
                log.info('hurray read the file : log.log');//logge den Erfolg
                resolve(mzdata);//gib das Ergebnis zurück
            }
        }
    )}
)};

//Nun suche und lese die Game.log Datei - gleicher Aufbau wie bei der Log.log Datei siehe eine Funktion zuvor
function getthegame() {
    return new Promise(function(resolve,reject){
        fs.readFile(prog_path+game_log, 'utf8',(err,tzdata) => {
            if (err){
                log.info('shit happens didnt read the game file: Game.log');
                reject(err);
            } else{
                log.info('hurray read the game file: Game.log');
                resolve(tzdata);
            }
        }
    )}
)};

// Funktion, um aus der log.log Datei den Spiele Installationspfad zu bekommen
function searchthepath(fgdata){
    return new Promise(function(resolve,reject){// auch hier wieder ein Verprechen
        gesplittet = fgdata.split(',');//teile die gesamte datei bei jedem , in ein Feldspeicher
        let T = true;//als Laufzeitvariable
        let x = gesplittet.length;// wieviele Einträge habe ich zu durchsuchen ?
        while (T) {// starte die Schleife solange Wahr
            x--;//verringere den Pointer
            if (gesplittet[x].toLowerCase().indexOf("launching star citizen live from (") >= 0){//finde ich den Mekrer String in dieser Zeile
                log.info('found path to game: '+ x);//jupp somit logge ich die Zeile
                T = false;//kann aus der Schleife raus
                let helper = gesplittet[x].split('(');//befreie nun den eigentlichen Pfad aus der Zeile von allem Ballast
                let bb = helper[1].indexOf(')');
                prog_path = helper[1].substring(0,bb);
                log.info(prog_path);//voila logge den Pfad
                resolve(prog_path);//gib diesen zurück
            }
            if (x<=0){// upps ich habe das Ende der Datei erreicht und keinen Eintrag gefunden - damit Notaus sonst stecken wir hier für immer fest
                T = false;// Laufvariable false
                log.info('found no path to game engine');// logge den Umstand
                wahr = false;//setze MErker für Misserfolg
                reject('no path found in log.log');//gib einen Fehler aus
            }
        }   
    }
)};


// Funktion zur Ermittlung des Spieler Handles
function searchgamehandle(bvdata){
    return new Promise(function(resolve,reject){//wieder als Veersprechen
        gesplittet = bvdata.split('\n');//gesamte Datei in Newline teilen
        let T = true;//wieder LAufzeitvariable definieren
        let x = gesplittet.length;//länge des Arrays ermitteln
        while (T) {//Solange wie Wahr
            x--;// von unten nach oben decrementieren den Pioter auf das Array
            if (gesplittet[x].toLowerCase().indexOf("user login success - handle[") >= 0){//suche nach dem String
                log.info('found Player Handle name in : '+ x);//gefunden in Zeile nr loggen
                T = false;// raus hier da sErfolg
                let helper = gesplittet[x].split('[');// ein wenig ballast entfernen
                let bb = helper[3].indexOf(']');
                let xxx = helper[3].substring(0,bb);
                log.info(xxx);// logge das handle
                resolve(xxx);//Rückgabe dessen
            }
            if (x<=0){//upps dateiende Erreicht und nnix gefunden somit Fehler
                T = false;
                log.error('found no player handle in game engine');
                wahr = false;
                reject('no player handle found in Game.log');
            }
        }   
    }
)};

// Eventbehandlung clipboard neuer Kontent durch Strg C
function clipboardchanged(qudata){
    if (qudata.toLowerCase().indexOf("coordinates:") >= 0){// ist es der coordinates eintrag
        try {// wenn ja versuche die Zahlen umzuwandeln
            let ncs = qudata.replace(':',' ').split(' ');//ersetze , mit .
            let npc = {// schreibe als JSON variable
                X:parseFloat(ncs[3].replace(',','.')/1000),//teile Wert durch 1000
                Y:parseFloat(ncs[5].replace(',','.')/1000),
                Z:parseFloat(ncs[7].replace(',','.')/1000)
            };
            log.info(`New Player Coodrdinates X: ${npc.X} , Y: ${npc.Y}, Z: ${npc.Z}`);//logge die Datein
            // hier Fehlt noch die Übergabe an die Backend API
        } catch (e) {//im Fehlerfall
            log.error(`Clipboard Event Error can not parse data : ${qudata} with error: ${e}`)//logge einen Fehler
        }
    }
};


//Eventbehandlung, wenn das Game.log geändert wurde
function logfilechanged(data){
    if (data.toLowerCase().indexOf("corpse") >= 0){// suche den String corpse
        let ngl = data.split('>');////splitte die Zeile nach >
        let helper = ngl[0];// suche den Eintrag
        let datum = helper.substr(1,helper.length);
        helper = ngl[2];
        let playerposstart = helper.toLowerCase().indexOf("player")+8;
        let playerposende = helper.toLowerCase().indexOf("<remote client")-2;
        let player = helper.substring(playerposstart,playerposende);
        helper = ngl[3];
        let b = false;
        let code = '';
        if (helper.toLowerCase().indexOf("yes, there is no local inventory") >= 0){//eintrag neuer Spieler gefunden
            code = "New Player logged in";
            b = true;
        }
        if ((helper.toLowerCase().indexOf("doeslocationcontainhospital") >= 0) && (b===false)){//Eintrag handlungsunfähig verletzt
            code = "Player is incapacitated";
            b = true;

        }
        if ((helper.toLowerCase().indexOf("yes, there is a local inventory") >= 0) && (b===false)){//Spieler gestorben
            code = "Player is dead";
            b = true;
        }     
        if ((helper.toLowerCase().indexOf("criminal arrest") >= 0)&&(b===false)){//spieler ist im Knast
            code = "Player is arrested";
            b = true;
        }
        if (b===false) {// unbekannter corpse
                code = "unknown Player Action!"
        }
        let npa = {//schreibe eine JSON Variable
            "Datum":datum,
            "PLayer":player,
            "Action":code
        };
        log.info(`Datum : ${datum} Game Handle: ${player} Action: ${code}`);
        // fehlt senden an API
    }
};

//Eventhandler für den Fenster fertig event
function startwindow(){
    tail = new Tail (prog_path+'\\Game.log');// überwache das Dateiende von Game.log mit einem Event
    tail.on('line', (linelog) => {
        log.info('log file changed:'+linelog);
        logfilechanged(linelog); // rufe den eventhanlder auf
    });
    tail.on('error', (error) => {// bei fehler
        log.error('log file changed:'+error);
    });        
    clipboardListener.startListening();// setze den Eventhandler zum Clipboard überwachen
    clipboardListener.on('change',() => {// bei Event
        const buffer = clipboard.readImage('clipboard').toPNG();// lies doch einfach mal ein Bild ein
        log.info (`Buffer typer : ${buffer.length}`);
        if (buffer > 0){
            const img = sharp(buffer).extrakt(config.left,config.top,config.width,config.height);
            sende_img(img);
        }
        const mytext = clipboard.readText('clipboard');// und versuch es mi einem Text
        log.info(`Text from Clipboard : ${mytext}`)
        clipboardchanged(mytext);// Auswertung mittels Funktion
    });
    app.whenReady().then(() => {// installiere Eventhandler App ready
        mywindow=createMainWindow();// erzeuge Neues Fenster
    })
    return mywindow
};

// alles mit erfolg abgelaufen????????
function onsuccess(){   
    return startwindow();
}

// oder gab es in der Kette einen Fehler
function onerror(err){
    log.error(`Ich habe Error: ${err}`);
}

//Funktion um einen neuen Accesstoken zu erhalten
function get_new_access(refrtok){
    return axios// mittels des Axios moduls
    .post(my_access_url,{'refresh':refrtok,
        headers: {
            'Content-Type': 'application/json'
        }})
    .then((response)=>{// erfolg neuen accesstoken speichern
        success_token = true;
        auth_token = response.data.access;
        log.info(`got answerfrom post new access token: ${auth_token} `);
    })
    .catch(function(error){//fehlerbehandlung
        log.info(`got Error response login Data: ${JSON.stringify(error.response.data) }   status: ${error.response.status }    Message: ${error.message }`);
        success_token = false;
    });
    ///log.info(`success_token from access function ${success_token}`);
    ///return success_token;
};

//Zeitschleife zur Generierung des Tokens
function refresh_auth_token(){
    lauf++;
    if (lauf === access_token_time){// vergleich mit sollzeit
        lauf=0;
        log.info('nun machen wir einen Auth Token refresh...');
        get_new_access(refr_token);// rufe funktion zur erneuerung auf
    };
};

//funktion zum speichern eines neuen refresh token
function store_new_token(tokens){
    get_token(process.env.ret,process.env.ret1,tokens.data.refresh,1);
    auth_token = tokens.data.access;
    refr_token = tokens.data.refresh;
};

//Nun aktualisiere den access token, wenn wir den in config.token finden
function config_token(data) {
    return new Promise(function(resolve){
        log.info(`Success found player Handle: ${data}`);
        my_game_handle = data;
        if(myconfig.token !== ""){// habe ich einen refresh token gespeichert?
            refr_token = get_token(process.env.ret,process.env.ret1,"",0);// dann lies Ihn aus
            resolve(get_new_access(refr_token));//hole dir einen neuen access Token von der API
        }
    }
)};


//function sendet den screenshop
function sende_img(img){

};


// hier startet das eigentliche Programm

init_log();
const timer_id = setInterval(() => {//rufe den Timer auf
    refresh_auth_token();
},8000);// alle 8 sekunden
if (process.platform !== 'darwin') {// bin ich auf windows ?
    log_path = process.env.HOME+'\\AppData';// dann ist der Launcher Ordner in 
    log.info('Path to AppData :'+log_path);
};
getthelogs()// arbeite folgende Funktionen der Reihe nach ab
    .then(searchthepath)
    .then(getthegame)
    .then(searchgamehandle)
    .then(config_token)
    .then(mywindow=onsuccess,onerror);// alles gut dann weiter sonst Fehelr

ipcMain.on("login_user", (event,args) =>{//KontextBridge zum Renderer Prozess - Hier Login Button gedrückt
    log.info(`got clicked data login : ${args}`);
    axios// post zur backendAPI
        .post(my_refresh_url,args,{
            headers: {
                'Content-Type': 'application/json',
            }})
        .then(function(response){// Erfolg speichere neue Tokense
            store_new_token(response);
            log.info(`got answerfrom post apitoken: ${response} `);
            link = "./renderer/main.html";
        log.info(`springe ab: ${link}`);
        mywindow.loadFile(link);// rufe neuen Fensterinhalt auf
        })
        .catch(function(error){// im Fehlerfall error
            mywindow.webContents.send('message:update',`Error Status: ${error.response.status} Detail : ${JSON.stringify(error.response.data)} `);
            log.info(`got Error response login Data: ${JSON.stringify(error.response.data) }   status: ${error.response.status }    Message: ${error.message }`);
        });
});

ipcMain.on("register_new_user", (event,args) =>{//KontextBridge zum Renderer Prozess - Hier Register Button gedrückt
    log.info(`got clicked data register : ${args}`);
    axios// post zur backendAPI
        .post(my_register_url,args,{
            headers: {
                'Content-Type': 'application/json',
            }})
        .then(function(response){// Erfolg speichere neue Tokense
            log.info(`got answerfrom post register: ${response} `);
            link = "./renderer/success.html";
        log.info(`springe ab: ${link}`);
        mywindow.loadFile(link);// rufe neuen Fensterinhalt auf
        })
        .catch(function(error){// im Fehlerfall error
            mywindow.webContents.send('message:update',`Error Status: ${error.response.status} Detail : ${JSON.stringify(error.response.data)} `);
            log.info(`got Error response register Data: ${JSON.stringify(error.response.data) }   status: ${error.response.status }    Message: ${error.message }`);
        });
});

ipcMain.on("reset_user_pw", (event,args) =>{//KontextBridge zum Renderer Prozess - Hier Register Button gedrückt
    log.info(`got clicked data reset PW : ${args}`);
    axios// post zur backendAPI
        .post(my_register_url,args,{
            headers: {
                'Content-Type': 'application/json',
            }})
        .then(function(response){// Erfolg speichere neue Tokense
            log.info(`got answerfrom post reset: ${response} `);
            link = "./renderer/success.html";
        log.info(`springe ab: ${link}`);
        mywindow.loadFile(link);// rufe neuen Fensterinhalt auf
        })
        .catch(function(error){// im Fehlerfall error
            mywindow.webContents.send('message:update',`Error Status: ${error.response.status} Detail : ${JSON.stringify(error.response.data)} `);
            log.info(`got Error response reset Data: ${JSON.stringify(error.response.data) }   status: ${error.response.status }    Message: ${error.message }`);
        });
});

app.on('window-all-closed', () => {// Wenn es keine Fenster mehr gibt, beende auch die App
    if (process.platform !== 'darwin') app.quit()
});


// Programm Ende

