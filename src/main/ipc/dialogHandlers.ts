import { ipcMain, dialog } from 'electron'

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:open-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Repository',
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })
}
