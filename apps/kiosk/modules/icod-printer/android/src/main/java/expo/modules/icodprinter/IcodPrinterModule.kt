package expo.modules.icodprinter

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.szsicod.print.escpos.PrinterAPI
import com.szsicod.print.io.UsbNativeAPI

class IcodPrinterModule : Module() {
  companion object {
    // The vendor SDK's Java classes never call System.loadLibrary themselves,
    // so the .so files bundled in jniLibs are never loaded without this.
    init {
      System.loadLibrary("usb1.0")
      System.loadLibrary("serial_icod")
      System.loadLibrary("image_icod")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("IcodPrinter")

    // Async function to initialize the printer with USB connection
    AsyncFunction("initPrinter") { ->
      // In ICOD, connecting via USBNativeAPI is standard for built-in printers
      val api = UsbNativeAPI()
      val result = PrinterAPI.getInstance().connect(api)
      if (result == 0) {
        PrinterAPI.getInstance().init()
        return@AsyncFunction true
      } else {
        return@AsyncFunction false
      }
    }

    // Print text string
    AsyncFunction("printString") { text: String ->
      if (PrinterAPI.getInstance().isConnect) {
        PrinterAPI.getInstance().printString(text, "UTF-8", false)
        return@AsyncFunction true
      }
      return@AsyncFunction false
    }

    // Print QR code
    AsyncFunction("printQRCode") { text: String, modeSize: Int ->
      if (PrinterAPI.getInstance().isConnect) {
        // modeSize: 1-6 (6 is default)
        PrinterAPI.getInstance().printQRCode(text, modeSize, false)
        return@AsyncFunction true
      }
      return@AsyncFunction false
    }

    // Cut paper and feed
    AsyncFunction("cutPaper") { ->
      if (PrinterAPI.getInstance().isConnect) {
        PrinterAPI.getInstance().printAndFeedPaper(100) // feed a bit
        PrinterAPI.getInstance().fullCut()
        return@AsyncFunction true
      }
      return@AsyncFunction false
    }
    
    // Disconnect
    AsyncFunction("disconnect") { ->
      if (PrinterAPI.getInstance().isConnect) {
        PrinterAPI.getInstance().disconnect()
        return@AsyncFunction true
      }
      return@AsyncFunction false
    }
  }
}
