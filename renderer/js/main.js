

function myfunction(){
    let ans ='';
    if (el1.checked === true){
        ans='True';
    } else {
        ans='False';
    };
    window.ipcRender.send("check1",ans);
};

const el1 = document.getElementById("check1");

if (el1) {
    el1.addEventListener('click', myfunction);
}

window.ipcRender.receive('window:closed',(text) => {
    el1.checked = false;
    console.log('click got from main');
});
