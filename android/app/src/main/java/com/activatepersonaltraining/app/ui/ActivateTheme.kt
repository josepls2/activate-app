package com.activatepersonaltraining.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val ActivateRed = Color(0xFFF21F3D)
val ActivateRedLight = Color(0xFFFF5064)
val AppBackground = Color(0xFF080808)
val Card = Color(0xFF1C1C1E)
val CardAlt = Color(0xFF2C2C2E)
val Muted = Color(0xFF9A9AA0)
val Success = Color(0xFF30D158)
val Warning = Color(0xFFFF9F0A)

private val ActivateColors = darkColorScheme(
    primary = ActivateRed,
    onPrimary = Color.White,
    secondary = ActivateRedLight,
    background = AppBackground,
    surface = Card,
    surfaceVariant = CardAlt,
    onBackground = Color.White,
    onSurface = Color.White,
    onSurfaceVariant = Color(0xFFD7D7DC),
    error = Color(0xFFFF453A),
)

@Composable
fun ActivateTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = ActivateColors, content = content)
}
