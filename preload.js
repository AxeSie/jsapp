const { contextBridge, ipcRenderer} = require('electron')

// White-listed channels.
const ipc = {
    'render': {
        // From render to main.
        'send': [
            'login_user',
            'register_new_user',
            'reset_user_pw'
        ],
        // From main to render.
        'receive': [
            'message:update' // Here is your channel name
        ],
        // From render to main and back again.
        'sendReceive': []
    }
};
/*
const bridge_api = {
    dosomething: (msg) => ipcRenderer.send("login_user",msg),
    regsomething: (msg) => ipcRenderer.send("register_new_user",msg),
    ressomething: (msg) => ipcRenderer.send("reset_user_pw",msg)

    
}
*/
contextBridge.exposeInMainWorld( 
        // Allowed 'ipcRenderer' methods.
    'ipcRender', {
        // From render to main.
        send: (channel, args) => {
            let validChannels = ipc.render.send;
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, args);
            }
        },
        // From main to render.
        receive: (channel, listener) => {
            let validChannels = ipc.render.receive;
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`.
                ipcRenderer.on(channel, (event, ...args) => listener(...args));
            }
        },
        // From render to main and back again.
        invoke: (channel, args) => {
            let validChannels = ipc.render.sendReceive;
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, args);
            }
        }
    }
);