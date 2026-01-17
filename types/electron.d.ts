interface ElectronAPI {
    enableLoopbackAudio: () => Promise<void>
    disableLoopbackAudio: () => Promise<void>
    isLoopbackAvailable: () => Promise<boolean>
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI
    }
}

export {}
