// https://www.gs1.org/services/how-calculate-check-digit-manually
function calculateGtinCheckSum(digits: string): string {
    digits = "" + digits;
    if (digits.length !== 13) throw new Error("needs to received 13 digits");
    const multiplier = [3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3];
    let sum = 0;
    try {
        // multiply each digit for its multiplier according to the table
        for (let i = 0; i < 13; i++)
            sum += parseInt(digits.charAt(i)) * multiplier[i];

        // Find the nearest equal or higher multiple of ten
        const remainder = sum % 10;
        let nearest;
        if (remainder === 0) nearest = sum;
        else nearest = sum - remainder + 10;

        return nearest - sum + "";
    } catch (e) {
        throw new Error(`Did this received numbers? ${e}`);
    }
}

export function generateGtin(): string {
    function pad(num: number, width: number, padding: string = "0") {
        const n = num + "";
        return n.length >= width
            ? n
            : new Array(width - n.length + 1).join(padding) + n;
    }

    const beforeChecksum = pad(Math.floor(Math.random() * 9999999999999), 13); // has to be 13. the checksum is the 4th digit
    const checksum = calculateGtinCheckSum(beforeChecksum);
    return `${beforeChecksum}${checksum}`;
}

export function getBatch() {
    return Math.random().toString(36).replace(".", "").toUpperCase().slice(5)
}