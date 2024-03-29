//// Modul Importe
const log = require('electron-log/main'); //log file modul - logged auf Console und %USER%\AppData\Roaming\Name der App\logs
const path = require('path'); // pfad modul
const fs = require('node:fs');
const axios = require('axios');//http modul
const clipboardListener = require ('clipboard-event');//modul zum Überwachen der Zwischenablage
Tail = require('tail').Tail;//Modul zur Überwachung der log Dateien
const { app, BrowserWindow, clipboard, ipcMain, screen } = require('electron');// referenz auf die Electron Module app ( die Anwendungsschicht), BrowserWindow (als Chromium Referenz), ipcMain (als Komminikation zum Renderer Prozess)
var crypto = require("crypto-js");// zur Verschlüsselten Speicherung des Refresh Token
const sharp = require('sharp');//schneidet das Bild zu
const FormData = require('form-data');//um ein Bild per post hochzuladen
const WebSocket = require ('ws');//websocket client
const exec = require('child_process').exec;//run taskmanager for getting the Game runs 
const { start } = require('repl');
const appVersion = require('electron').app.getVersion();
const {access , constants, unlink} = require ('node:fs/promises');


let erlaube_dev_tools;
let base_url;
let ws_url;
let game_process;
let my_access_url;
let my_refresh_url;
let my_register_url;
let my_reset_url;
let my_uploadpic_url;
let my_ws_url;
let my_get_ws_uuid;
let mybounds;
let lauf = 0; // Laufzeit für die Gültigkeit des Access Tokens - wenn kurz for Ablauf bitte an der API erneuern lassen
const access_token_time = 100; // per aktueller Definition ist die Gültigkeit des Accesstokens 15 Minuten oder 900 sec. danach muss er mit dem Refresh Token erneuert werden
let lauf2 = 0;
const search_update_time = 4;
let auth_token ="";// Zwischenspeicher für den accesstoken - flüchtig mit Programm ende
let refr_token ="";// gleiche für den refresh token
let success_token = false;//dient als Merker für den erfolgreichen Loginalgorithmus
let my_server_ip = '';//init variable zur IP Speicherung
let game_running = false;// merker zum Spiel im Speicher
let mywindow ;
let childwindow;
let myaktwind;
let tail;
let ws;
let uuid;
let my_devTools;
let my_game_handle;
let myconfig;
let config_path;
let search_update = false;
let path_log;
let ret="ss&ew(){!+334rer";
let ret1="!eeRqLLp)()qXXd2";
let ret2="ichhabehunger!0w";
let node_config="\\AppData\\local\\Programs\\ISR Tool\\config\\";
let mydisplay;
    



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

async function deletelog(ff){
    try{
        await unlink(ff);
        log.info(`Deleted : ${ff}`);
    } catch (error) {
        log.error (`Got an error tying to delete file: ${error.message}`);
    }
};

function startwerte() {
    return new Promise(function(resolve){ //asynchroner aufruf
        myconfig={
            logging:"true",
            node_env:"development",
            level_prod:"error",
            level_dev:"debug",
            dev_tools_erlaubt:"false",
            url_dev:"//127.0.0.1:8000/",
            url_prod:"//isrtooling.de/",
            path_log:"c:\\rsi\\StarCitizen\\LIVE\\Game.log",
            screen_width:1920,
            screen_height:1080,
            left:1350,
            top:100,
            width:500,
            height:900,
            displ_name:"",
            x:100,
            y:100,
            w:550,
            h:600,
            op:0,
            gamename_dev:"chrome.exe",
            gamename_prod:"StarCitizen.exe"
        }
        config_path = process.env.USERPROFILE+node_config;
        //log.info(config_path);
        if (fs.existsSync(config_path)){
            //log.info('Config file directory check OK');
            try{
                fs.accessSync(config_path+'.config.json',constants.R_OK)
                //log.info('Config file vorhanden check OK - lese Daten');
                myconfig = JSON.parse(fs.readFileSync(config_path+'.config.json','utf8'));
            }catch{
                //log.warn('keine Config Datei vorhanden - erstelle');
                fs.writeFileSync(config_path+'.config.json', JSON.stringify(myconfig,null,2));//speichern in Datei
            };
        } else {
            //log.warn('Verzeichnis zum config file nicht vorhanden erstelle')
            fs.mkdirSync(config_path,{recursive:true},function(err){
                if (err){
                    log.error('Kann Verzeichnis für Config Datei nicht erstellen! - Abbruch');
                    reject(err);
                } 
            });
            //log.info('Config Datei Verzeichnis erstellt- erstelle nun die Datei');
            fs.writeFileSync(config_path+'.config.json', JSON.stringify(myconfig,null,2));//speichern in Datei  
        }
        const timer_id = setInterval(() => {//rufe den Timer auf
            check_game_is_running();
            refresh_auth_token();
        },9000);// alle 9 sekunden
        if (myconfig.node_env === "production"){
            erlaube_dev_tools = myconfig.dev_tools_erlaubt;    
            base_url = "https:"+myconfig.url_prod;
            ws_url = "ws:"+myconfig.url_prod;
            game_process = myconfig.gamename_prod;
            log.transports.console.level = myconfig.level_prod;
            log.transports.file.level = myconfig.level_prod;
            path_log = myconfig.path_log;
            //search_update = true;
        } else{
            erlaube_dev_tools = "true";
            base_url = "http:"+myconfig.url_dev;
            ws_url = "ws:"+myconfig.url_dev;
            game_process = myconfig.gamename_dev;
            log.transports.console.level = myconfig.level_dev;//Level aus Config für Konsole
            log.transports.file.level = myconfig.level_dev;//Level für File aus Config        
            path_log = "./dev/Game.log";
            //search_update = false;
        };
        if (myconfig.logging !== 'true'){// Ich möchte login komplett abstellen somit alles flase
            log.transports.file.level = false;
            log.transports.console.level = false;
        };
        if (erlaube_dev_tools === "true"){
            my_devTools:true;
        } else{
            my_devTools:false;
        };
        log.info(`Aktuelle App Version : ${appVersion} ProgLevel: ${myconfig.node_env}`);
        my_access_url = base_url+"api/token/refresh/";//url zur aktualisierung vom accesstoken
        my_refresh_url = base_url+"api/token/";// url zum einloggen
        my_register_url = base_url+"api/register/";//url zum registern
        my_reset_url = base_url+"api/reset/";// URL zum Password reset
        my_uploadpic_url = base_url+"api/files/images/";//url zum Image upload
        my_ws_url = ws_url+"ws/jette/";
        my_get_ws_uuid = base_url+'jette';
        mybounds = {x:myconfig.x,y:myconfig.y,width:myconfig.w,height:myconfig.h};
        my_game_handle =myconfig.handle;//lese das Gamehandle AUS DER config datei
        log.info(`meine url ${base_url}`);
        resolve();
    });
};

//Funktion zum Überprüfen, ob das Game läuft
function isRunning(proc){
    return new Promise(function(resolve, reject){ //asynchroner aufruf
        exec('tasklist', function(err, stdout, stderr) {// rufe externes Programm tasklist auf
            if (err) reject(err);// wenn Feher dann schlecht
            resolve(stdout.toLowerCase().includes(proc.toLowerCase()));// existiert ein Task, der wie das Game heisst ?
        })
    })
};

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
        fs.writeFileSync(config_path+'.config.json', JSON.stringify(myconfig,null,2));//speichern in Datei
    } else {// sonst entschlüsseln
        return mydecrypt (myconfig.token);//Rückgabe direkt aus config
    };
};

//Funktion zur Erzeugung einer FensterKlasse
async function createMainWindow(){
    if (myconfig.displ_name === ""){
        lx=mydisplay.bounds.x+myconfig.x;
        ly=mydisplay.bounds.y+myconfig.y;
    } else {
        lx=myconfig.x;
        ly=myconfig.y;
    };
    mywindow = new BrowserWindow({//vererbt von Chomium
        x:lx,
        y:ly,
        width: 500,//Fenstebreite
        height:600,//Fensterhöhe
        frame: false,//Rahmenlos
        transparent: true,//transparent
        resizeable : true,//zoombar
        alwaysOnTop: true,//immer im Vordergrund
        webPreferences:{//Verhalten in die Welt ( aus diversen Gründen wird die App mit vollem Computerzugriff vom Renderer Prozess abgekapselt)
            preload: path.join(__dirname,'preload.js'),// keinen Direkten Aussenweltkontakt - dieser erfolgt über eine Kontextbrücke ( Sicherheitsrelevant)
            contextIsolation: true,//auch der Kontext an sich ist nicht für die Aussenwelt verfügbar
            devTools : my_devTools,
        }
    });

    //mywindow.once('ready-to-show',() =>{
        //if (search_update){
        //    log.info('Look for App updates')
        //    autoUpdater.checkForUpdatesAndNotify();
      //  }
    //});

    mywindow.on('close', () => {
        bbb = mywindow.getBounds();
        myconfig.x = bbb.x
        myconfig.y = bbb.y
        myconfig.w = bbb.width
        myconfig.h = bbb.height
        if (mydisplay){
            myconfig.displ_name = mydisplay.id;
        };
        myconfig.op = mywindow.getOpacity()
        fs.writeFileSync(config_path+'.config.json', JSON.stringify(myconfig,null,2));//speichern in Date
        log.info(`Window Bounds to save-> Monitor: ${myconfig.displ_name} Bounds: ${myconfig.x} Opacity: ${myconfig.op}`);
    });
    if (success_token){// wurde der Loginprozess erfolgreich abgeschlossen ?
        mywindow.loadFile(path.join(__dirname,'./renderer/main.html'));//ja weiter mit der App
    } else {//nein
        mywindow.loadFile(path.join(__dirname,'./renderer/index.html'));//somit bitte Login renderen
    };
    //return mainWindow;
}

//Nun suche und lese die Game.log Datei - gleicher Aufbau wie bei der Log.log Datei siehe eine Funktion zuvor
function getthegame() {//habe den Pfad  erhalten
    return new Promise(function(resolve,reject){//arbeite weiter synchron
        fs.readFile(path_log, 'utf8',(err,tzdata) => {// lies die Datei ein
            if (err){// Fehler ist schlecht
                log.error(`shit happens didnt read the game file: Game.log at ${path_log}`);
                reject(err);// geht auf Fehler stopp
            } else{// alles gelesen 
                log.info(`hurray read the game file: Game.log ${path_log}`);
                resolve(tzdata);// gib diese Daten Weiter
            }
        })
    })
};

// Funktion zur Ermittlung der Server IP
function searchip(data){
    return new Promise(function(resolve,reject){//wieder als Veersprechen           
        if (game_running){
            let T = true;//wieder LAufzeitvariable definieren
            let x = data.length;//länge des Arrays ermitteln
            while (T) {//Solange wie Wahr
                x--;// von unten nach oben decrementieren den Pioter auf das Array
                if (data[x].toLowerCase().indexOf("<channel connection complete>") >= 0){//suche nach dem String
                    log.info('found Gameserver IP in : '+ x);//gefunden in Zeile nr loggen
                    T = false;// raus hier da sErfolg
                    let bb = data[x].toLowerCase().indexOf("sockaddr");
                    let xxx = data[x].substr(bb,25);
                    let b3 = xxx.toLowerCase().indexOf(":");
                    let x4 = xxx.substring(9,b3);
                    log.info(`Server IP : ${x4}`)
                    my_server_ip = x4
                    resolve(x4);//Rückgabe dessen
                }
                if (x<=0){//upps dateiende Erreicht und nnix gefunden somit Fehler
                    T = false;
                    log.error('found no IP in Game log - maybe we dont have one jet');
                    wahr = false;
                    //reject('no Game Server IP found in Game.log');
                }
            }   
        } else {
            resolve(game_running);
        }
    }
)};

// Funktion zur Ermittlung des Spieler Handles
function searchgamehandle(bvdata){
    return new Promise(function(resolve,reject){//wieder als Veersprechen
        if (game_running){
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
                    if (typeof my_game_handle !== 'undefined'){//ohne Game handle gibt es nicht lösbare Abhängigkeiten. Somit ist eines notwnedig
                        if (xxx !== my_game_handle) {
                            log.error(`Schwer wiegender Fehler Game Handle stimmen nicht ueberein! gespeichert: ${my_game_handle} | vom Game: ${xxx}` );
                            reject("Game Handle mismatch - Abbruch");
                        }
                    } else {// habdle ist da somit weiter
                        my_game_handle = xxx;
                        myconfig.handle=xxx;
                        log.info('Game Handle war noch nicht gespeichert - Hole nach!');
                        //fs.writeFileSync(config_path+'.config.json', JSON.stringify(myconfig,null,2));//speichern in Datei
                    }
                    resolve(gesplittet);//weitergabe der Daten aus game.log für IP finden
                }
                if (x<=0){//upps dateiende Erreicht und nnix gefunden somit Fehler
                    T = false;
                    log.warn('found no player handle in game engine mybe the game is not running');
                    wahr = false;
                    //reject('no player handle found in Game.log');
                }
            }
        } else {
            resolve(game_running);
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
            ws.send(JSON.stringify({"type":"Clip_Message", "message": npc}))
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
        ws.send(`message:{npa} `);
    }
        // fehlt senden an API
    if (data.toLowerCase().indexOf("user login success - handle[") >= 0){//suche nach dem String
        log.info(` Got Player Handle name in `);//gefunden in Zeile nr loggen
        let helper = data.split('[');// ein wenig ballast entfernen
        let bb = helper[3].indexOf(']');
        let xxx = helper[3].substring(0,bb);
        log.info(` Game Handle ${xxx}`);// logge das handle
        if (typeof my_game_handle !== 'undefined'){
            if (xxx !== my_game_handle){
                log.error(`Schwer wiegender Fehler Game Handle stimmen nicht ueberein! gespeichert: ${my_game_handle} | vom Game: ${xxx}` );
                process.exit();
            }
        } else {
            my_game_handle = xxx;
            myconfig.handle=xxx;
            log.info('Game Handle war noch nicht gespeichert - Hole nach!');
            //fs.writeFileSync(config_path+'.config.json', JSON.stringify(myconfig,null,2));//speichern in Datei
        }
    }
    if (data.toLowerCase().indexOf("<channel connection complete>") >= 0){//suche nach dem String
        log.info('Got found Gameserver IP !');//gefunde
        let bb = data.toLowerCase().indexOf("sockaddr");
        let xxx = data.substr(bb,25);
        let b3 = xxx.toLowerCase().indexOf(":");
        let x4 = xxx.substring(9,b3);
        log.info(`Server IP : ${x4}`)
        my_server_ip = x4
    }
};

// alles mit erfolg abgelaufen????????
function onsuccess(v){ 
    log.info('Alle Vorbereitungen abgeschlossen ---- auf zum Start');  
    app.whenReady().then(() => {
        let gefunden = false;
        if (myconfig.displ_name === ""){
            log.info('Suche Monitore ...');
            const displays = screen.getAllDisplays();
            const primary_display = screen.getPrimaryDisplay();
            displays.forEach((display)=>{
                if (primary_display.id !== display.id){
                    mydisplay=display;
                    gefunden = true;
                    log.info(`found not primary display : ${mydisplay.id}`);
                }
            })
            if (!gefunden){
                mydisplay=primary_display;
                log.info(`Nur Primaeres Display gefunden ${mydisplay.id}`)
            }
        }
        createMainWindow()});
};

// oder gab es in der Kette einen Fehler
function onerror(err){
    log.error(`Ich habe Error: ${err}`);
    //throw new Error(`Fehler in Programmablauf ${err}`)
    process.exit();
};

//Funktion um einen neuen Accesstoken zu erhalten
function get_new_access(refrtok){
    return axios// mittels des Axios moduls
    .post(my_access_url,{'refresh':refrtok,
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }})
    .then((response)=>{// erfolg neuen accesstoken speichern
        success_token = true;
        auth_token = response.data.access;
        log.info(`got answerfrom post new access token: ${auth_token} `);
    })
    .catch(function(error){//fehlerbehandlung
        if (error.code === 'ECONNABORTED'){
            log.error('Request timed out Backend');
        } else {
            log.error(`got Error response login Data: ${JSON.stringify(error.response.data) }   status: ${error.response.status }    Message: ${error.message }`);
            success_token = false;
            log.warn(`I think Refreshtoken expired - lets try to log in again`);
            if (typeof mywindow !== 'undefined'){
                link = "./renderer/index.html";
                mywindow.loadFile(link);//somit bitte Login renderen    
            };
        }
    });
};

//Zeitschleife zur Generierung des Tokens
function refresh_auth_token(){
    lauf++;
    if (lauf > access_token_time){// vergleich mit sollzeit
        lauf=0;
        lauf2++;
        log.info('nun machen wir einen Auth Token refresh...');
        get_new_access(refr_token);// rufe funktion zur erneuerung auf
    }
    if (lauf2 > search_update_time){
        lauf2 = 0;
        if (search_update){
            log.info('Check also for App Updates');
            autoUpdater.checkForUpdatesAndNotify();
        }
    }
}

//funktion zum speichern eines neuen refresh token
function store_new_token(tokens){
    get_token(ret,ret1,tokens.data.refresh,1);
    auth_token = tokens.data.access;
    refr_token = tokens.data.refresh;
};

//Nun aktualisiere den access token, wenn wir den in config.token finden
function config_token(data) {
    return new Promise(function(resolve){
        if (typeof myconfig.token !== 'undefined'){
            if(myconfig.token !== ""){// habe ich einen refresh token gespeichert?
                refr_token = get_token(ret,ret1,"",0);// dann lies Ihn aus
                resolve(get_new_access(refr_token));//hole dir einen neuen access Token von der API
            }else {
                log.info('leerer Token gespeichert');
                resolve(game_running);
            }
        } else {
            log.info('Kein Token gespeichert');
            resolve(game_running);
        }
    }
)};

//function sendet den screenshop
function sende_img(img_path){
    const myform = new FormData();
    myform.append("image",fs.createReadStream(img_path));
    axios// mittels des Axios moduls
    .post(my_uploadpic_url,myform,{
        timeout:5000,
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': 'Bearer '+auth_token,
        }})
    .then((response)=>{// erfolg Datei hochgeladen
        log.info(`Bild erfolgreich hochgeladenm ${response.status} `);
        fs.rmSync(img_path,{force:true,});
    })
    .catch(function(error){//fehlerbehandlung
        if (error.code === 'ECONNABORTED'){
            log.error('Request an Backend Post Image timed out');
        } else {
            log.error(`got Error response Upload Bild status: ${error.response.status }    Message: ${error.message }`);
        }
    });
};

//Funktion for game running check and varibanen merkrer
function check_game_is_running(){
    return new Promise(function(resolve,reject){
        isRunning(game_process).then((v) => {
            if (v){
                log.info('Game is running');
                game_running = true;
            } else {
                log.warn('Game is not active');
                game_running = false;
            }
            resolve();
        })
    })
};

//handle zum aktuellen Fenster
function get_actual_window(){
    myaktwind = screen.get();
    if (myaktwind.getTitle() === myconfig.win_name){
        myaktwind.setBounds(mybounds);
        log.info(`did set Window Bounds : ${myaktwind.getTitle()}`);
    } else {
        log.info(`Got wrong Window ${myaktwind.getTitle()}`);
    };
};


function heartbeat(){
    clearTimeout(this.pingTimeout);
    log.info('got Heartbeat from backend for ws');
    this.pingTimeout = setTimeout(() => {
        this.terminate();
        log.error('Lost Connection to Websocket Server')
    }, 30000 + 1000);
};

//Message handling from Websocket
function werte_aus(data){

};

// websocket handling
function starte_ws(){
    axios// post zur backendAPI
        .get(my_get_ws_uuid,{
            timeout:5000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+auth_token,
            }})
        .catch((error) => {// im Fehlerfall error
            if (error.code === 'ECONNABORTED'){
                log.error('Request an Backend Get WS UUID timed out');
            } else {
                log.error(`got Error response get WS UUID: ${JSON.stringify(error.response.data) }   status: ${error.response.status }    Message: ${error.message }`);
            }
        })
        .then((response) => {// Erfolg speichere neue Tokense
            log.info(`got answerfrom get uuid: ${response.data['uuid']} `);
            uuid = response.data['uuid'];
            log.info(`made out of it: ${uuid} `);
            log.info(`my ws url: ${my_ws_url}`)
            ws = new WebSocket(my_ws_url+'start/?uuid='+uuid,{
                perMessageDeflate:false,
            });
            ws.on('error',(error) => {
                log.error(`Got Websocket Error : ${error}`);
            });
            ws.on('open', heartbeat);
            ws.on('ping', heartbeat);     
            ws.on('close',function clear() {
                log.info('Websocket closed');
                clearTimeout(this.pingTimeout);
            });
            ws.on('message',function message (data){
                log.info(`Got message over Websockets : ${data}`);
                werte_aus(data);
        })
    })
};

function onFinally(){
    tail = new Tail (path_log);// überwache das Dateiende von Game.log mit einem Event
    clipboardListener.startListening();// setze den Eventhandler zum Clipboard überwachen
    clipboardListener.on('change',() => {// bei Event
        let buffer = clipboard.readImage().toPNG();// lies doch einfach mal ein Bild ein
        log.info (`Picture Buffer typer : ${buffer.length}`);
        if (buffer.length > 0){
            const img = sharp(buffer)
            let img_path = `./renderer/images/sendtobackend/output${Date.now()}.png`;
            img.metadata()
            .then(function (metadata){
                log.info(`Bild Weite: ${metadata.width} , Höhe: ${metadata.height}`);
                if ((myconfig.screen_width === metadata.width)&&(myconfig.screen_height === metadata.height)){
                        log.info("Image Größe bekannt - Schnittmuster bekannt");
                        sharp(buffer).extract({left:myconfig.left,top:myconfig.top,width:myconfig.width,height:myconfig.height})
                        .toFile(img_path)
                        .then(info => { 
                            log.info(`Datei geschrieben : ${info}`);
                            sende_img(img_path);
                        })
                        .catch(err =>{
                            log.error(`Fehler beim Datei schreiben : ${err}`)
                        });
                } else {
                    log.error("Image Größe unbekannt bzw Schnittmuster unbekannt  - bitte korrigieren - ");
                };
            });
        } else {
            const mytext = clipboard.readText('clipboard');// und versuch es mi einem Text
            log.info(`Text from Clipboard : ${mytext}`)
            clipboardchanged(mytext);// Auswertung mittels Funktion
        };
    });

    tail.on('line', (linelog) => {
        log.info('log file changed:'+linelog);
        logfilechanged(linelog); // rufe den eventhanlder auf
    });

    tail.on('error', (error) => {// bei fehler
        log.error('log file changed:'+error);
    }); 
};

// hier startet das eigentliche Programm
const mypromise = new Promise((resolve,reject) =>{
    deletelog(process.env.USERPROFILE+"\\AppData\\Roaming\\ISR Tool\\logs\\main.log")
    .then(log.initialize);
    resolve();
});

mypromise
    .then (startwerte)
    .then(check_game_is_running)
    .then(getthegame)
    .then(searchgamehandle)
    .then(searchip)
    .then(config_token)
    .finally(onFinally)
    .then(onsuccess,onerror)
    .catch(() =>{
        log.error('habe error');
    });

       

app.on('window-all-closed', () => {// Wenn es keine Fenster mehr gibt, beende auch die App
    if (process.platform !== 'darwin') app.quit()
});

ipcMain.on("login_user", (event,args) =>{//KontextBridge zum Renderer Prozess - Hier Login Button gedrückt
    let mm = JSON.parse(args);
    log.info(`got clicked data login : ${mm.username}`);
    axios// post zur backendAPI
        .post(my_refresh_url,args,{
            timeout:5000,
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
            if (error.code === 'ECONNABORTED'){
                log.error('Request an Backend Post Login timed out');
            } else {
                log.error(`got Error response login Data: ${JSON.stringify(error.response.data) }   status: ${error.response.status }    Message: ${error.message }`);
            }
        });
});

ipcMain.on("register_new_user", (event,args) =>{//KontextBridge zum Renderer Prozess - Hier Register Button gedrückt
    let mm = JSON.parse(args);
    log.info(`got clicked data register : ${mm.username}`);
    my_game_handle = mm.last_name;
    myconfig.handle = my_game_handle;
    //fs.writeFileSync(config_path+'.config.json', JSON.stringify(myconfig,null,2));//speichern in Date
    axios// post zur backendAPI
        .post(my_register_url,mm,{
            timeout:5000,
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
            log.error(`error response register: ${error}`);
            if (error.code === 'ECONNABORTED'){
                log.error('Request an Backend Post Register timed out');
                mywindow.webContents.send('message:update',`Error : Verbindung Zeitüberlauf`);
            }
            if (error.code === 'ECONNREFUSED'){
                log.error('Request an Backend Post Register refused');
                mywindow.webContents.send('message:update',`Error: Verbindung zurückgewiesen`);
            }
            if (error.response){
                log.error(`got Error response register Data: ${JSON.stringify(error.response.data) }   status: ${error.response.status }    Message: ${error.message }`);
                mywindow.webContents.send('message:update',`Error Status: ${error.response.status} Detail : ${JSON.stringify(error.response.data)} `);
            }
        });
});

ipcMain.on("reset_user_pw", (event,args) =>{//KontextBridge zum Renderer Prozess - Hier Register Button gedrückt
    log.info(`got clicked data reset PW : ${args}`);
    axios// post zur backendAPI
        .post(my_register_url,args,{
            timeout:5000,
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
            if (error.code === 'ECONNABORTED'){
                log.error('Request an Backend Get Reset timed out');
            } else {
                log.error(`got Error response reset Data: ${JSON.stringify(error.response.data) }   status: ${error.response.status }    Message: ${error.message }`);
            }
        });
});

ipcMain.on("check1", (event,args) =>{//KontextBridge zum Renderer Prozess - Hier öffne Chat Fenster
    log.info(`got checkbox 1 clicked signal is: ${args}`);
    if (args === 'True'){
        starte_ws();
    }else{
       ws.close(); 
    };
});

//ipcMain.on("restart_app",() => {
//    log.info('got quit and install from GUI');
//    autoUpdater.quitAndInstall();
//});

//autoUpdater.on('update-available', () => {
//    log.info('Message to gui new release');
//    mywindow.webContents.send('message:new_release','update_available');
//  });

//autoUpdater.on('update-downloaded', () => {
//    log.info('New Release is down - please restart');
//    mywindow.webContents.send('message:release_down','update_downloaded');
//  });




///child window
///childwindow = new BrowserWindow({modal:true, show:false})
///        childwindow.loadFile('./renderer/chat.html');
///        childwindow.once('ready-to-show',() => {
//            childwindow.show();
//        });
//        childwindow.on('close',() =>{

//log.info('Got child windows closed');
//            mywindow.webContents.send('window:closed','Error Status: Window Cloased Detail : none ');
//        });