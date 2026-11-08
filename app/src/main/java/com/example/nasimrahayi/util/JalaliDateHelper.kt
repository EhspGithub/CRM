package com.example.nasimrahayi.util

import java.util.Calendar

object JalaliDateHelper {

    fun gregorianToJalali(gy: Int, gm: Int, gd: Int): Triple<Int, Int, Int> {
        val gDaysInMonth = intArrayOf(0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334)
        var jy = if (gy <= 1600) 0 else 979
        var gYear = gy - (if (gy <= 1600) 621 else 1600)
        val gy2 = if (gm > 2) gYear + 1 else gYear
        var days = (365 * gYear) + ((gy2 + 3) / 4) - ((gy2 + 99) / 100) + ((gy2 + 399) / 400) - 80 + gd + gDaysInMonth[gm - 1]
        jy += 33 * (days / 12053)
        days %= 12053
        jy += 4 * (days / 1461)
        days %= 1461
        jy += (days - 1) / 365
        if (days > 365) days = (days - 1) % 365
        val jm = if (days < 186) 1 + (days / 31) else 7 + ((days - 186) / 30)
        val jd = 1 + (if (days < 186) days % 31 else (days - 186) % 30)
        return Triple(jy, jm, jd)
    }

    fun jalaliToGregorian(jy: Int, jm: Int, jd: Int): Triple<Int, Int, Int> {
        var gy = if (jy <= 979) 621 else 1600
        var jYear = jy - (if (jy <= 979) 0 else 979)
        var days = (365 * jYear) + ((jYear / 33) * 8) + (((jYear % 33) + 3) / 4) + 78 + jd +
                (if (jm < 7) (jm - 1) * 31 else ((jm - 7) * 30) + 186)
        gy += 400 * (days / 146097)
        days %= 146097
        if (days > 36524) {
            gy += 100 * (--days / 36524)
            days %= 36524
            if (days >= 365) days++
        }
        gy += 4 * (days / 1461)
        days %= 1461
        gy += (days - 1) / 365
        if (days > 365) days = (days - 1) % 365

        val gDays = intArrayOf(
            0, 31,
            if ((gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0)) 29 else 28,
            31, 30, 31, 30, 31, 31, 30, 31, 30, 31
        )
        var gm = 0
        while (gm < 12 && days >= gDays[gm]) {
            days -= gDays[gm]
            gm++
        }
        val gd = days + 1
        return Triple(gy, gm, gd)
    }

    fun getShamsiToday(): String {
        val cal = Calendar.getInstance()
        val gy = cal.get(Calendar.YEAR)
        val gm = cal.get(Calendar.MONTH) + 1
        val gd = cal.get(Calendar.DAY_OF_MONTH)
        val (jy, jm, jd) = gregorianToJalali(gy, gm, gd)
        val mm = if (jm < 10) "0$jm" else "$jm"
        val dd = if (jd < 10) "0$jd" else "$jd"
        return "$jy/$mm/$dd"
    }

    fun getShamsiFormattedDate(): String {
        val cal = Calendar.getInstance()
        val gy = cal.get(Calendar.YEAR)
        val gm = cal.get(Calendar.MONTH) + 1
        val gd = cal.get(Calendar.DAY_OF_MONTH)
        val (jy, jm, jd) = gregorianToJalali(gy, gm, gd)

        val monthNames = arrayOf(
            "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
            "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
        )
        val monthName = if (jm in 1..12) monthNames[jm - 1] else ""
        return "${toPersianDigits(jd.toString())} $monthName ${toPersianDigits(jy.toString())}"
    }

    fun toPersianDigits(text: String): String {
        val persianDigits = charArrayOf('۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹')
        val sb = StringBuilder()
        for (ch in text) {
            if (ch in '0'..'9') {
                sb.append(persianDigits[ch - '0'])
            } else {
                sb.append(ch)
            }
        }
        return sb.toString()
    }

    fun toEnglishDigits(text: String): String {
        val sb = StringBuilder()
        for (ch in text) {
            when (ch) {
                '۰' -> sb.append('0')
                '۱' -> sb.append('1')
                '۲' -> sb.append('2')
                '۳' -> sb.append('3')
                '۴' -> sb.append('4')
                '۵' -> sb.append('5')
                '۶' -> sb.append('6')
                '۷' -> sb.append('7')
                '۸' -> sb.append('8')
                '۹' -> sb.append('9')
                else -> sb.append(ch)
            }
        }
        return sb.toString()
    }

    fun formatNumber(number: Number): String {
        return toPersianDigits(number.toString())
    }
}
