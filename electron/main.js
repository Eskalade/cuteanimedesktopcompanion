const {
	app,
	BrowserWindow,
	Tray,
	Menu,
	screen,
	globalShortcut,
	session,
	systemPreferences,
	ipcMain
} = require("electron")
const path = require("path")

// System audio loopback for capturing audio from other apps
let audioLoopbackAvailable = false
try {
	const { initMain } = require("electron-audio-loopback")
	initMain()
	audioLoopbackAvailable = true
	console.log("[AUDIO] System audio loopback initialized")
} catch (err) {
	console.warn("[AUDIO] electron-audio-loopback not available:", err.message)
	console.warn("[AUDIO] Falling back to microphone-only mode")
}

let mainWindow = null
let tray = null
let isClickThrough = false

// Register IPC handlers at module load (remove first to handle hot reload)
console.log("[IPC] Registering IPC handlers...")
try {
	ipcMain.removeHandler('is-loopback-available')
	ipcMain.removeHandler('enable-loopback-audio')
	ipcMain.removeHandler('disable-loopback-audio')
	console.log("[IPC] Removed existing handlers (hot reload detected)")
} catch (e) {
	console.log("[IPC] No existing handlers to remove (first load)")
}

ipcMain.handle('is-loopback-available', () => {
	console.log("[IPC] is-loopback-available called, returning:", audioLoopbackAvailable)
	return audioLoopbackAvailable
})
ipcMain.handle('enable-loopback-audio', () => {
	console.log('[AUDIO] Loopback audio enabled for getDisplayMedia')
})
ipcMain.handle('disable-loopback-audio', () => {
	console.log('[AUDIO] Loopback audio disabled')
})
console.log("[IPC] IPC handlers registered successfully")

function createWindow() {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize

	mainWindow = new BrowserWindow({
		width: 300,
		height: 350,
		minWidth: 200,
		minHeight: 200,
		maxWidth: 800,
		maxHeight: 800,
		x: width - 320,
		y: height - 370,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		resizable: true,
		hasShadow: false,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
			// Enable desktop audio capture on Windows/Linux
			enableWebRTC: true,
			allowDisplayingInsecureContent: true
		}
	})

	// Load the Next.js app
	const isDev = process.env.NODE_ENV !== "production"
	if (isDev) {
		mainWindow.loadURL("http://localhost:3000/desktop?debug=1")
		// Open DevTools in dev mode (detached so it doesn't resize the window)
		mainWindow.webContents.openDevTools({ mode: "detach" })
	} else {
		mainWindow.loadFile(path.join(__dirname, "../out/desktop.html"))
	}

	// Make window draggable from anywhere
	mainWindow.setIgnoreMouseEvents(false)

	mainWindow.on("closed", () => {
		mainWindow = null
	})
}

function createTray() {
	// Use a simple icon (you can replace with your own)
	tray = new Tray(path.join(__dirname, "icon.jpg"))

	const contextMenu = Menu.buildFromTemplate([
		{
			label: "Toggle Click-Through",
			click: () => {
				isClickThrough = !isClickThrough
				mainWindow?.setIgnoreMouseEvents(isClickThrough, { forward: true })
			}
		},
		{
			label: "Reset Position",
			click: () => {
				const { width, height } = screen.getPrimaryDisplay().workAreaSize
				mainWindow?.setPosition(width - 320, height - 370)
			}
		},
		{ type: "separator" },
		{
			label: "Quit Vibe Buddy",
			click: () => {
				app.quit()
			}
		}
	])

	tray.setToolTip("Vibe Buddy")
	tray.setContextMenu(contextMenu)
}

app.whenReady().then(async () => {
	// Handle media permissions
	session.defaultSession.setPermissionRequestHandler(
		(webContents, permission, callback) => {
			if (permission === "media") {
				callback(true)
			} else {
				callback(false)
			}
		}
	)

	// macOS: Check/request screen recording permission (required for system audio loopback)
	if (process.platform === "darwin") {
		const screenAccess = systemPreferences.getMediaAccessStatus("screen")
		console.log("[AUDIO] Screen recording permission status:", screenAccess)

		if (screenAccess !== "granted") {
			console.log("[AUDIO] Screen recording permission not granted - requesting...")
			// Request microphone permission (this CAN be requested programmatically)
			const micGranted = await systemPreferences.askForMediaAccess("microphone")
			console.log("[AUDIO] Microphone permission:", micGranted ? "granted" : "denied")

			// For screen recording, we can only check status - user must manually enable in System Preferences
			// The permission dialog will appear when the app first attempts screen capture
			console.log("[AUDIO] Screen recording permission must be granted manually:")
			console.log("[AUDIO] System Preferences > Privacy & Security > Screen & System Audio Recording")
		}
	}

	createWindow()
	createTray()

	// Global shortcut to toggle visibility
	globalShortcut.register("CommandOrControl+Shift+V", () => {
		if (mainWindow?.isVisible()) {
			mainWindow.hide()
		} else {
			mainWindow?.show()
		}
	})

	// Global shortcut to toggle DevTools (Cmd+Shift+I or Ctrl+Shift+I)
	globalShortcut.register("CommandOrControl+Shift+I", () => {
		if (mainWindow?.webContents.isDevToolsOpened()) {
			mainWindow.webContents.closeDevTools()
		} else {
			mainWindow?.webContents.openDevTools({ mode: "detach" })
		}
	})

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})

app.on("will-quit", () => {
	globalShortcut.unregisterAll()
})
