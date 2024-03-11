
function myfunction(){
    var mypayload = {
        "username":uname.value,
        "password":passw.value
    }
    window.ipcRender.send("login_user",JSON.stringify(mypayload));
};

function myfunction2(){
    if (!hp1 || !hp2){
        var mypayload = {
            "username":uname.value,
            "email":email.value,
            "password":passw.value,
            "last_name":gamehandle.value
        }    
        window.ipcRender.send("register_new_user",JSON.stringify(mypayload));
    } else {
        text.innerText = "Problem Bot am Werk rejected";
    };
};

function myfunction3(){
    var mypayload = {
        "username":uname.value
    }
    window.ipcRender.send("reset_user_pw",JSON.stringify(mypayload));
};

function myfunction4(){
    note.classList.add('hidden');
}

function myfunction5(){
    window.ipcRender.send("restart_app","restart_app");
}

const hp1 = document.getElementById("ht");
const hp2 = document.getElementById("ht1");
const uname = document.getElementById("user");
const passw = document.getElementById("pass");
const email = document.getElementById("email");
const gamehandle = document.getElementById("gamehandle");
const text = document.getElementById("text-caption");
const el = document.getElementById("loginbtn");
const ef = document.getElementById("registerbtn");
const ei = document.getElementById("resetbtn");
const note = document.getElementById("mitteilung")
const nachr = document.getElementById("nachricht")
const ed = document.getElementById("closemessagebtn")
const ew = document.getElementById("updatemessagebtn")

if (el) {
    el.addEventListener('click', myfunction);
}
if (ef) {
    ef.addEventListener('click', myfunction2);
}
if (ei) {
    ei.addEventListener('click', myfunction3);
}

if (ed) {
    ed.addEventListener('click', myfunction4);
}

if (ew) {
    ew.addEventListener('click', myfunction5);
}

window.ipcRender.receive('message:update',(message) => {
    text.innerText = message;
});

window.ipcRender.receive('message:new_release',() => {
    nachr.innerText = ' Neue App Version verfügbar -> wird heruntergeladen ';
    note.classList.remove('hidden');
});

window.ipcRender.receive('message:release_down',() => {
    nachr.innerText = ' Neue App Version zur Installation nach Neustart bereit! Jetzt neu starten ? ';
    ew.classList.remove('hidden');
    note.classList.remove('hidden');
});