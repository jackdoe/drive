const exec = require("child_process").exec
var Jimp = require("jimp");

const LINE_WIDTH_METERS = 0.04; // 4 cm

var contrast = function (image) {
    image
        .scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            var red = this.bitmap.data[idx + 0];
            var green = this.bitmap.data[idx + 1];
            var blue = this.bitmap.data[idx + 2];
            var alpha = this.bitmap.data[idx + 3];
            if (red > blue + 20 && red > green + 20) {
                // absolute zero is our pixel
                image.bitmap.data[idx + 0] = 0;
                image.bitmap.data[idx + 1] = 0;
                image.bitmap.data[idx + 2] = 0;
                image.bitmap.data[idx + 3] = 255;
            }
        });
}

var calibrate = function (image) {
    // XXX: this can be greatly improved
    var width = image.bitmap.width;
    var height = image.bitmap.height;
    var heightMap = {}
    var y = height - 1;
    var firstBlackPixel = 0;
    var lastBlackPixel = 0;
    for (var x = 0; x < width; x++) {
        var pixel = Jimp.intToRGBA(image.getPixelColor(x, y))
        if (pixel.r == 0 && pixel.g == 0 && pixel.b == 0) {
            if (firstBlackPixel == 0 || firstBlackPixel > x) 
                firstBlackPixel = x
            if (lastBlackPixel < x) 
                lastBlackPixel = x
        }
    }
    var pixelToMeter = (lastBlackPixel - firstBlackPixel) / LINE_WIDTH_METERS
    return pixelToMeter
}

// https://stackoverflow.com/questions/25277023/complete-solution-for-drawing-1-
// pixel-line-on-html5-canvas http://jsfiddle.net/m1erickson/3j7hpng0/ Refer to:
// http://rosettacode.org/wiki/Bitmap/Bresenham's_line_algorithm#JavaScript
var bline = function bline(image, color, x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0),
        sx = x0 < x1
            ? 1
            : -1;
    var dy = Math.abs(y1 - y0),
        sy = y0 < y1
            ? 1
            : -1;
    var err = (dx > dy
        ? dx
        : -dy) / 2;
    while (true) {
        image.setPixelColor(color, x0, y0)
        if (x0 === x1 && y0 === y1) 
            break;
        var e2 = err;
        if (e2 > -dx) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dy) {
            err += dx;
            y0 += sy;
        }
    }
}

var extractRoute = function (image, pixelsToMeter) {
    var width = image.bitmap.width;
    var height = image.bitmap.height;

    var routes = []
    var addRoute = function (currentCenter, y) {
        if (routes.length == 0) {
            routes.push({prev: undefined, center: currentCenter, from: y, to: undefined})
        } else {
            var lastRoute = routes[routes.length - 1];
            if (!lastRoute.to) {
                lastRoute.to = y
            } else {
                if (Math.abs(lastRoute.center - currentCenter) > (pixelsToMeter / 200)) {
                    routes.push({prev: lastRoute, center: currentCenter, from: y, to: undefined})
                } else {
                    lastRoute.to = y;
                }
            }
        }
    }

    for (var y = height - 1; y >= 0; y--) {
        var sum = 0;
        var blackPixels = 0;

        for (var x = 0; x < width; x++) {
            var pixel = Jimp.intToRGBA(image.getPixelColor(x, y))
            if (pixel.r == 0 && pixel.g == 0 && pixel.b == 0) {
                sum += x;
                blackPixels++;
            }
        }
        var centerBlackPosition = Math.round(sum / blackPixels);
        addRoute(centerBlackPosition, y)

        // using blue to check how good our pixel to meter calibration is
        var leftRightColorMark = ((pixelsToMeter * LINE_WIDTH_METERS) / 2) * 0.9;
        var color = Jimp.rgbaToInt(0, 0, 255, 255);
        if (y < height - 10) {
            var leftRightColorMark = 10
            var color = Jimp.rgbaToInt(255, 0, 0, 255);

        }
        for (var i = centerBlackPosition - leftRightColorMark; i < centerBlackPosition + leftRightColorMark; i++) {
            if (i < 0) 
                continue;
            if (i > width) 
                continue;
            image.setPixelColor(color, i, y)
        }
    }

    for (var route of routes) {
        var color = Jimp.rgbaToInt(255, 255, 255, 255);
        // because y grows in reverse, 'to' is smaller than 'from'
        for (var y = route.to; y < route.from; y++) {
            for (var i = route.center - 2; i < route.center + 2; i++) {
                image.setPixelColor(color, i, y)
            }
        }
    }

    var j = 0
    var out = []
    for (var route of routes) {
        j++;
        var color = Jimp.rgbaToInt(0, j % 2
            ? 255
            : 0, j % 2
            ? 0
            : 255, 255);
        if (route.prev) {
            var line = {
                x0: route.prev.center,
                y0: Math.round((route.prev.to + route.prev.from) / 2),
                x1: route.center,
                y1: Math.round((route.to + route.from) / 2)
            }
            out.push(line)
            bline(image, color, line.x0, line.y0, line.x1, line.y1)
        } else {
            var line = {
                x0: route.center,
                y0: route.from,
                x1: route.center,
                y1: Math.round((route.to + route.from) / 2)
            }
            out.push(line)
            bline(image, color, line.x0, line.y0, line.x1, line.y1)
        }
    }
    console.log(out)
    return out;
}

/*

lets say the line is N cm, then when we look below the camera,
or y=height, the black region we should give us pixel -> meters relationship
we will simply got to the firs tline that is complete and nice contrasted

          /
         /
        /|
       / | height
      /  |
     /)Q |
----+----+%%%%---------%%%%%%-----------------------------
   /               table
  /
 /

*/

Jimp.read(process.argv[2] || "../data/picture-from-iphone-45-degree.png", function (err, image) {
    if (err) 
        throw err;
    var originalWidth = image.bitmap.width
    image.resize(Jimp.AUTO, 512)

    contrast(image)

    var pixelsToMeter = calibrate(image)
    extractRoute(image, pixelsToMeter)

    image.resize(Jimp.AUTO, originalWidth)
    image.write("processed.png")

    exec('open processed.png').unref()
});
