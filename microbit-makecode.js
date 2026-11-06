// micro:bit V1.5 · MakeCode JavaScript editor
// USB serial 115200 bps. Each message uses a two-line frame.
// The CLASS payload is kept exactly as received (including case and spaces).
// Copy this entire file into https://makecode.microbit.org/ > JavaScript.
// External passive piezo buzzer: + to P0, - to GND (no external supply).
// STATUS:BUZZER is sent only after 60 continuous seconds by the web app.

let pendingFrame = ""
let pendingAt = 0
let lastClass = ""
let goodClass = "Class 1"
let buzzerActive = false
let lastBuzzerAt = 0

function stopBuzzer() {
    buzzerActive = false
    pins.analogPitch(0, 0)
}

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
pins.analogSetPitchPin(AnalogPin.P0)
stopBuzzer()
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
                stopBuzzer()
                showGood()
            } else if (line == "STATUS:BUZZER") {
                buzzerActive = true
                lastBuzzerAt = input.runningTime()
                showWarning()
            } else if (line == "STATUS:WARNING") {
                stopBuzzer()
                showWarning()
            } else if (line == "STATUS:CHECK") {
                stopBuzzer()
                showChecking()
            } else if (line == "STATUS:UNKNOWN") {
                stopBuzzer()
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
    let now = input.runningTime()
    // No heartbeat for 3 seconds: browser closed, USB lost, or inference stalled.
    if (buzzerActive && now - lastBuzzerAt >= 3000) {
        stopBuzzer()
        showWaiting()
    }
    if (buzzerActive) {
        // A passive buzzer needs a waveform. Alternate 200 ms tone and silence.
        // Duration 0 is nonblocking so serial stop commands stay responsive.
        pins.analogPitch(Math.idiv(now, 200) % 2 == 0 ? 2000 : 0, 0)
    }
    if (pendingFrame != "" && input.runningTime() - pendingAt > 2000) {
        pendingFrame = ""
        serial.writeString("ERROR:FRAME_TIMEOUT\n")
    }
    basic.pause(100)
})
