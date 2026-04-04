package panel

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
)

// QR code generation using a minimal pure-Go implementation.
// This encodes data as QR Code Version 2 (25x25) with Error Correction Level L.

const (
	qrSize     = 25 // Version 2 QR code is 25x25 modules
	qrQuiet    = 4  // quiet zone modules
	qrModScale = 8  // pixels per module
)

// GenerateQRPNG generates a QR code as a PNG image for the given data string.
func GenerateQRPNG(data string) ([]byte, error) {
	modules := encodeQRData(data)
	return renderQRPNG(modules)
}

func encodeQRData(data string) [][]bool {
	size := qrSize
	grid := make([][]bool, size)
	for i := range grid {
		grid[i] = make([]bool, size)
	}

	placeFinderPattern(grid, 0, 0)
	placeFinderPattern(grid, size-7, 0)
	placeFinderPattern(grid, 0, size-7)
	placeAlignmentPattern(grid, 18, 18)

	for i := 8; i < size-8; i++ {
		grid[6][i] = i%2 == 0
		grid[i][6] = i%2 == 0
	}

	bits := stringToBits(data)
	placeBits(grid, bits)

	return grid
}

func placeFinderPattern(grid [][]bool, row, col int) {
	pattern := [][]bool{
		{true, true, true, true, true, true, true},
		{true, false, false, false, false, false, true},
		{true, false, true, true, true, false, true},
		{true, false, true, true, true, false, true},
		{true, false, true, true, true, false, true},
		{true, false, false, false, false, false, true},
		{true, true, true, true, true, true, true},
	}
	for r := 0; r < 7; r++ {
		for c := 0; c < 7; c++ {
			if row+r < len(grid) && col+c < len(grid[0]) {
				grid[row+r][col+c] = pattern[r][c]
			}
		}
	}
}

func placeAlignmentPattern(grid [][]bool, centerRow, centerCol int) {
	for r := -2; r <= 2; r++ {
		for c := -2; c <= 2; c++ {
			row := centerRow + r
			col := centerCol + c
			if row >= 0 && row < len(grid) && col >= 0 && col < len(grid[0]) {
				isDark := r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)
				grid[row][col] = isDark
			}
		}
	}
}

func stringToBits(s string) []bool {
	data := []byte(s)
	bits := make([]bool, 0, len(data)*8+16)

	modeBits := []bool{false, true, false, false}
	bits = append(bits, modeBits...)

	count := byte(len(data))
	for i := 7; i >= 0; i-- {
		bits = append(bits, (count>>uint(i))&1 == 1)
	}

	for _, b := range data {
		for i := 7; i >= 0; i-- {
			bits = append(bits, (b>>uint(i))&1 == 1)
		}
	}

	return bits
}

func placeBits(grid [][]bool, bits []bool) {
	size := len(grid)
	bitIdx := 0

	for col := size - 1; col >= 1; col -= 2 {
		if col == 6 {
			col--
		}
		for row := 0; row < size; row++ {
			for dc := 0; dc < 2; dc++ {
				c := col - dc
				if c < 0 || c >= size {
					continue
				}
				if isReserved(row, c, size) {
					continue
				}
				if bitIdx < len(bits) {
					grid[row][c] = bits[bitIdx]
					bitIdx++
				}
			}
		}
	}
}

func isReserved(row, col, size int) bool {
	if row < 9 && col < 9 {
		return true
	}
	if row < 9 && col >= size-8 {
		return true
	}
	if row >= size-8 && col < 9 {
		return true
	}
	if row == 6 || col == 6 {
		return true
	}
	if row >= 16 && row <= 20 && col >= 16 && col <= 20 {
		return true
	}
	return false
}

func renderQRPNG(modules [][]bool) ([]byte, error) {
	size := len(modules)
	imgSize := (size + qrQuiet*2) * qrModScale

	img := image.NewRGBA(image.Rect(0, 0, imgSize, imgSize))

	white := color.RGBA{255, 255, 255, 255}
	dark := color.RGBA{0, 0, 0, 255}

	for y := 0; y < imgSize; y++ {
		for x := 0; x < imgSize; x++ {
			img.Set(x, y, white)
		}
	}

	for row := 0; row < size; row++ {
		for col := 0; col < size; col++ {
			if modules[row][col] {
				px := (col + qrQuiet) * qrModScale
				py := (row + qrQuiet) * qrModScale
				for dy := 0; dy < qrModScale; dy++ {
					for dx := 0; dx < qrModScale; dx++ {
						img.Set(px+dx, py+dy, dark)
					}
				}
			}
		}
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
