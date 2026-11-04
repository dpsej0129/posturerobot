// micro:bit V1.5 · MakeCode JavaScript editor
// USB serial 115200 bps. Each message uses a two-line frame.
// The CLASS payload is kept exactly as received (including case and spaces).
// Copy this entire file into https://makecode.microbit.org/ > JavaScript.

let pendingFrame = ""
let pendingAt = 0
let lastClass = ""
let goodClass = "Class 1"

function showWaiting() {
    basic.showLeds(`
        . . . . .
        . . . . .
        . # # # .
        . . . . .
        . . . . .
    `, 0)
}

function showGood() {
    basic.showLeds(`
        . . . . .
        . . . . #
        . . . # .
        # . # . .
        . # . . .
    `, 0)
}

function showWarning() {
    basic.showLeds(`
        . . # . .
        . . # . .
        . . # . .
        . . . . .
        . . # . .
    `, 0)
}

function showChecking() {
    basic.showLeds(`
        . # # # .
        . . . # .
        . . # . .
        . . . . .
        . . # . .
    `, 0)
}

serial.redirectToUSB()
serial.setBaudRate(BaudRate.BaudRate115200)
serial.setRxBufferSize(128)
showWaiting()

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let line = serial.readUntil(serial.delimiters(Delimiters.NewLine))
    // Accept CRLF from manual terminals, but do not trim class names.
    if (line.length > 0 && line.charAt(line.length - 1) == "\r") {
        line = line.substr(0, line.length - 1)
    }
    if (pendingFrame != "" && input.runningTime() - pendingAt > 2000) {
        pendingFrame = ""
    }
    if (pendingFrame != "") {
        let type = pendingFrame
        pendingFrame = ""
        if (type == "CLASS") {
            lastClass = line
            // The web app also sends its stabilized semantic state separately.
            if (lastClass == goodClass) {
                showGood()
            } else {
                showChecking()
            }
            serial.writeString("ACK:CLASS:" + lastClass + "\n")
        } else if (type == "GOODCLASS") {
            goodClass = line
            serial.writeString("ACK:GOODCLASS:" + goodClass + "\n")
        } else if (type == "STATUS") {
            if (line == "STATUS:GOOD") {
                showGood()
            } else if (line == "STATUS:WARNING") {
                showWarning()
            } else if (line == "STATUS:CHECK") {
                showChecking()
            } else if (line == "STATUS:UNKNOWN") {
                showWaiting()
            } else {
                serial.writeString("ERROR:UNKNOWN_STATUS\n")
                return
            }
            serial.writeString("ACK:" + line + "\n")
        }
        return
    }
    // Payloads are consumed before headers, so even a class named
    // "FRAME:STATUS" or "STATUS:WARNING" cannot become a control command.
    if (line == "FRAME:CLASS") {
        pendingFrame = "CLASS"
    } else if (line == "FRAME:STATUS") {
        pendingFrame = "STATUS"
    } else if (line == "FRAME:GOODCLASS") {
        pendingFrame = "GOODCLASS"
    } else {
        serial.writeString("ERROR:EXPECTED_FRAME\n")
    }
    pendingAt = input.runningTime()
})

basic.forever(function () {
    if (pendingFrame != "" && input.runningTime() - pendingAt > 2000) {
        pendingFrame = ""
        serial.writeString("ERROR:FRAME_TIMEOUT\n")
    }
    basic.pause(100)
})
