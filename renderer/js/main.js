

function myfunction(){
    let ans ='';
    if (el1.checked === true){
        ans='True';
        childWindow = window.open('./chat.html','modal');
        ///modal.loadFile(`./renderer/chat.html`);
    } else {
        ans='False';
        childWindow.close();
    };
    window.ipcRender.send("check1",ans);
};

const el1 = document.getElementById("check1");

if (el1) {
    el1.addEventListener('click', myfunction);
}

