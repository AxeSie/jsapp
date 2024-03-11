const { contextBridge, ipcRenderer} = require('electron')

// White-listed channels.
const ipc = {
    'render': {
        // From render to main.
        'send': [
            'login_user',
            'register_new_user',
            'reset_user_pw',
            'check1',
            'restart_app',
        ],
        // From main to render.
        'receive': [
            'message:update', // Here is your channel name
            'message:new_release',
            'message:release_down',
            'window:closed',
        ],
        // From render to main and back again.
        'sendReceive': [],
    }
};

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