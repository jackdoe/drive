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
    var y = height;
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

var cleanup = function (image, pixelsToMeter) {
    var width = image.bitmap.width;
    var height = image.bitmap.height;
    for (var y = 0; y < height; y++) {
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
    cleanup(image, pixelsToMeter)

    image.resize(Jimp.AUTO, originalWidth)
    image.write("processed.png")

    exec('open processed.png').unref()
});
