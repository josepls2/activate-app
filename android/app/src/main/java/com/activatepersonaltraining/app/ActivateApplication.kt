package com.activatepersonaltraining.app

import android.content.Context
import android.content.Intent
import android.provider.CalendarContract
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.activatepersonaltraining.app.ui.ActivateRed
import com.activatepersonaltraining.app.ui.ActivateRedLight
import com.activatepersonaltraining.app.ui.AppBackground
import com.activatepersonaltraining.app.ui.Card
import com.activatepersonaltraining.app.ui.CardAlt
import com.activatepersonaltraining.app.ui.Muted
import com.activatepersonaltraining.app.ui.Success
import com.activatepersonaltraining.app.ui.Warning
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

@Composable
fun ActivateApplication(store: AppStore = remember { AppStore() }) {
    LaunchedEffect(Unit) {
        store.restoreAuthentication()
    }
    if (store.isCheckingAuthentication) {
        Box(
            modifier = Modifier.fillMaxSize().background(AppBackground),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator(color = ActivateRed)
        }
        return
    }
    val role = store.role
    if (role == null) {
        LoginScreen(onLogin = store::signIn)
    } else {
        MainShell(store = store, role = role)
    }
}

@Composable
private fun LoginScreen(onLogin: (String, String, (String?) -> Unit) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSigningIn by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AppBackground)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Spacer(Modifier.height(8.dp))
        Image(
            painter = painterResource(R.drawable.activate_logo),
            contentDescription = "Activate Personal Training",
            modifier = Modifier.fillMaxWidth().height(150.dp),
            contentScale = ContentScale.Fit,
        )
        Text(
            "Activate Personal Training",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "Accede con tu cuenta. Los permisos se asignan automáticamente.",
            color = Muted,
        )

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Contraseña") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = {
                isSigningIn = true
                errorMessage = null
                onLogin(email, password) {
                    errorMessage = it
                    isSigningIn = false
                }
            },
            enabled = !isSigningIn && email.contains("@") && password.length >= 6,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text(if (isSigningIn) "Accediendo…" else "Entrar", fontWeight = FontWeight.Bold)
        }
        errorMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }
        Text(
            "Acceso seguro conectado con Activate",
            color = Muted,
            fontSize = 12.sp,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
    }
}

@Composable
private fun MainShell(store: AppStore, role: Role) {
    val tabs = store.tabsFor(role)
    Scaffold(
        containerColor = AppBackground,
        bottomBar = {
            NavigationBar(
                modifier = Modifier.navigationBarsPadding(),
                containerColor = Card,
            ) {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = store.selectedTab == tab,
                        onClick = { store.selectedTab = tab },
                        icon = { Text(tab.symbol, fontSize = 17.sp) },
                        label = {
                            Text(
                                tab.label,
                                maxLines = 1,
                                overflow = TextOverflow.Clip,
                                fontSize = 9.sp,
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = ActivateRedLight,
                            selectedTextColor = ActivateRedLight,
                            indicatorColor = ActivateRed.copy(alpha = .14f),
                            unselectedIconColor = Muted,
                            unselectedTextColor = Muted,
                        ),
                    )
                }
            }
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .statusBarsPadding(),
        ) {
            when (store.selectedTab) {
                AppTab.CLIENTS -> ClientsScreen(store, role)
                AppTab.SESSIONS -> SessionsScreen(store, role)
                AppTab.BOOKINGS -> BookingsScreen(store, role)
                AppTab.CYCLE -> CycleScreen(store)
                AppTab.CHAT -> ChatScreen(store)
                AppTab.NUTRITION -> NutritionScreen()
                AppTab.PACK -> PackScreen(store, role)
                AppTab.PROFILE -> ProfileScreen(store, role)
            }
        }
    }
}

@Composable
private fun ClientsScreen(store: AppStore, role: Role) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            ScreenHeader(
                role.label,
                "Clientes",
                if (role == Role.BOSS) "Resumen de todo el centro"
                else "Sólo tus clientes asignados",
            )
        }
        if (store.clients.isEmpty()) {
            item {
                EmptyCard(
                    "Sin clientes asignados",
                    "Los clientes reales aparecerán aquí al crearlos en Dirección.",
                )
            }
        }
        items(store.clients, key = { it.id }) { client ->
            val cycle = store.sharedCycleSummaries.firstOrNull {
                it.clientId == client.id
            }
            AppCard {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(client.name, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(client.email, color = Muted, fontSize = 12.sp)
                    }
                    Text(
                        "${client.remainingSessions}",
                        color = ActivateRedLight,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
                Text(
                    "${client.usedSessions} usadas · ${client.reservedSessions} reservadas · " +
                        "${client.packTotalSessions} totales",
                    color = Muted,
                    fontSize = 12.sp,
                )
                LinearProgressIndicator(
                    progress = {
                        if (client.packTotalSessions == 0) 0f
                        else client.usedSessions.toFloat() / client.packTotalSessions
                    },
                    modifier = Modifier.fillMaxWidth(),
                    color = ActivateRed,
                    trackColor = CardAlt,
                )
                Text(
                    "Entrenadores: ${client.trainerNames.joinToString().ifEmpty { "Sin asignar" }}",
                    color = Muted,
                    fontSize = 12.sp,
                )
                if (client.gender == "female" && client.cycleTrackingEnabled) {
                    HorizontalDivider(color = CardAlt)
                    if (!client.cycleSharingEnabled) {
                        Text("Ciclo · privado", color = Muted, fontSize = 12.sp)
                    } else if (cycle == null) {
                        Text("Ciclo · sin registros compartidos", color = Muted, fontSize = 12.sp)
                    } else {
                        val flow = when (cycle.flow) {
                            "light" -> "ligero"
                            "medium" -> "medio"
                            "heavy" -> "intenso"
                            else -> "sin flujo"
                        }
                        Text(
                            "Ciclo ${cycle.date} · $flow",
                            color = ActivateRedLight,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                        )
                        if (cycle.symptoms.isNotEmpty()) {
                            Text(cycle.symptoms.joinToString(), color = Muted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SessionsScreen(store: AppStore, role: Role) {
    var showRequestDialog by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val sessions = store.sessions
    val requests = store.bookings.filter {
        role == Role.CLIENT &&
            (it.status == BookingStatus.PENDING_TRAINER ||
                it.status == BookingStatus.PENDING_BOSS)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            ScreenHeader(
                role.label,
                if (role == Role.CLIENT) "Mis entrenos" else "Sesiones",
                if (role == Role.TRAINER) "Esta semana" else "Agenda del centro piloto",
            )
        }
        if (role == Role.CLIENT) {
            item {
                Button(
                    onClick = { showRequestDialog = true },
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                ) {
                    Text("+  Pedir una sesión", fontWeight = FontWeight.Bold)
                }
            }
            if (requests.isNotEmpty()) {
                item { SectionTitle("Mis solicitudes", requests.size) }
                items(requests, key = { it.id }) { BookingCard(it) }
            }
        }
        item { SectionTitle("Próximas y recientes", sessions.size) }
        items(sessions, key = { it.id }) { session ->
            SessionCard(
                session = session,
                canComplete = role == Role.TRAINER || role == Role.BOSS,
                onComplete = { store.completeSession(session.id) },
                onAddToCalendar = { addToDeviceCalendar(context, session) },
            )
        }
    }

    if (showRequestDialog) {
        RequestSessionDialog(
            duration = store.packDuration,
            onDismiss = { showRequestDialog = false },
            onConfirm = { date, type ->
                store.requestSession(date, type)
                showRequestDialog = false
            },
        )
    }
}

@Composable
private fun RequestSessionDialog(
    duration: Int,
    onDismiss: () -> Unit,
    onConfirm: (String, String) -> Unit,
) {
    val dateOptions = remember {
        (1L..7L).map { LocalDate.now().plusDays(it).toString() }
    }
    var date by remember { mutableStateOf(dateOptions.first()) }
    var type by remember { mutableStateOf("Entrenamiento personal") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Pedir una sesión") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Tu entrenador confirmará directamente la hora.", color = Muted)
                Text("Duración del pack: $duration min", color = ActivateRedLight)
                dateOptions.forEach {
                    FilterChip(
                        selected = date == it,
                        onClick = { date = it },
                        label = { Text(it) },
                    )
                }
                listOf("Entrenamiento personal", "Fuerza", "Movilidad").forEach {
                    FilterChip(
                        selected = type == it,
                        onClick = { type = it },
                        label = { Text(it) },
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(date, type) }) { Text("Enviar solicitud") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
private fun SessionCard(
    session: TrainingSession,
    canComplete: Boolean,
    onComplete: () -> Unit,
    onAddToCalendar: () -> Unit,
) {
    AppCard {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(session.clientName, fontWeight = FontWeight.Bold)
                Text(
                    "${session.date} · ${session.time} · ${session.duration} min",
                    color = Muted,
                    fontSize = 13.sp,
                )
            }
            StatusPill(session.status.label, statusColor(session.status))
        }
        Text("${session.trainerName}  ·  ${session.room}", color = Muted, fontSize = 12.sp)
        if (session.packSessionNumber != null && session.packTotalSessions != null) {
            Text(
                "Sesión ${session.packSessionNumber} de ${session.packTotalSessions} del pack",
                color = ActivateRedLight,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        session.feedback?.let {
            Surface(color = CardAlt, shape = RoundedCornerShape(10.dp)) {
                Text(it, modifier = Modifier.padding(10.dp), fontSize = 12.sp)
            }
        }
        if (session.status == SessionStatus.CONFIRMED) {
            OutlinedButton(
                onClick = onAddToCalendar,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Añadir al calendario")
            }
        }
        if (canComplete && session.status == SessionStatus.CONFIRMED) {
            OutlinedButton(onClick = onComplete, modifier = Modifier.fillMaxWidth()) {
                Text("Marcar como completada")
            }
        }
    }
}

private fun addToDeviceCalendar(context: Context, session: TrainingSession) {
    val day = runCatching { LocalDate.parse(session.date) }
        .getOrElse { LocalDate.now().plusDays(1) }
    val time = runCatching { LocalTime.parse(session.time) }
        .getOrElse { LocalTime.of(9, 0) }
    val start = day.atTime(time)
        .atZone(ZoneId.systemDefault())
        .toInstant()
        .toEpochMilli()
    val end = start + session.duration * 60_000L

    val intent = Intent(Intent.ACTION_INSERT)
        .setData(CalendarContract.Events.CONTENT_URI)
        .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
        .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end)
        .putExtra(CalendarContract.Events.TITLE, session.type)
        .putExtra(
            CalendarContract.Events.EVENT_LOCATION,
            "Activate Personal Training · ${session.room}",
        )
        .putExtra(
            CalendarContract.Events.DESCRIPTION,
            "Entrenador: ${session.trainerName}",
        )
    context.startActivity(intent)
}

@Composable
private fun BookingsScreen(store: AppStore, role: Role) {
    var showRoomRequest by remember { mutableStateOf(false) }
    val actionable = when (role) {
        Role.TRAINER -> store.bookings.filter { it.status == BookingStatus.PENDING_TRAINER }
        Role.BOSS -> store.bookings.filter { it.status == BookingStatus.PENDING_BOSS }
        else -> emptyList()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            ScreenHeader(
                role.label,
                if (role == Role.RESERVE) "Ocupación de salas" else "Reservas",
                if (role == Role.RESERVE) "Solo lectura · próximos 7 días"
                else "Entrenadores confirman sesiones · Dirección confirma salas",
            )
        }
        if (role == Role.RESERVE) {
            item {
                Button(
                    onClick = { showRoomRequest = true },
                    enabled = store.rooms.isNotEmpty() && store.remainingSessions > 0,
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                ) {
                    Text("Reservar una sala", fontWeight = FontWeight.Bold)
                }
            }
            item { SectionTitle("Mis solicitudes", store.bookings.size) }
            items(store.bookings, key = { it.id }) { BookingCard(it) }
        }
        if (role == Role.TRAINER || role == Role.BOSS) {
            item {
                SectionTitle(
                    if (role == Role.TRAINER) "Confirmar entrenamiento"
                    else "Confirmar reservas de sala",
                    actionable.size,
                )
            }
            if (actionable.isEmpty()) {
                item { EmptyCard("Todo al día", "No hay solicitudes en esta sección.") }
            }
            items(actionable, key = { it.id }) { request ->
                BookingCard(
                    request,
                    action = if (role == Role.TRAINER) "Proponer 09:00"
                    else "Confirmar ${request.proposedTime ?: "09:00"}",
                    onAction = {
                        if (role == Role.TRAINER) {
                            store.proposeTime(request.id, "09:00")
                        } else {
                            store.confirmBooking(
                                request.id,
                                request.proposedTime ?: "09:00",
                                request.room,
                            )
                        }
                    },
                )
            }
        }
        item { SectionTitle("Estado de salas", store.rooms.size) }
        items(store.rooms, key = { it.name }) { RoomCard(it) }
    }

    if (showRoomRequest) {
        RequestRoomDialog(
            rooms = store.rooms,
            occupiedSlots = store.occupiedSlots,
            duration = store.packDuration,
            onDismiss = { showRoomRequest = false },
            onConfirm = { date, time, room ->
                store.requestSession(
                    date = date,
                    type = "Uso de sala",
                    time = time,
                    room = room,
                )
                showRoomRequest = false
            },
        )
    }
}

@Composable
private fun RequestRoomDialog(
    rooms: List<Room>,
    occupiedSlots: List<OccupiedSlot>,
    duration: Int,
    onDismiss: () -> Unit,
    onConfirm: (String, String, String) -> Unit,
) {
    val dates = remember { (1L..7L).map { LocalDate.now().plusDays(it).toString() } }
    val times = remember { (7..20).map { String.format("%02d:00", it) } }
    var date by remember { mutableStateOf(dates.first()) }
    var room by remember { mutableStateOf(rooms.first().name) }
    var time by remember { mutableStateOf(times.first()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Reservar sala") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("Bono de $duration minutos", color = ActivateRedLight)
                Text("Sala", fontWeight = FontWeight.Bold)
                rooms.forEach { value ->
                    FilterChip(
                        selected = room == value.name,
                        onClick = { room = value.name },
                        label = { Text(value.name) },
                    )
                }
                Text("Día", fontWeight = FontWeight.Bold)
                dates.forEach { value ->
                    FilterChip(
                        selected = date == value,
                        onClick = { date = value },
                        label = { Text(value) },
                    )
                }
                Text("Hora", fontWeight = FontWeight.Bold)
                times.forEach { value ->
                    val start = value.take(2).toInt() * 60
                    val occupied = occupiedSlots.any {
                        val other = it.time.take(2).toInt() * 60 +
                            it.time.takeLast(2).toInt()
                        it.date == date && it.room == room &&
                            other >= start && other < start + duration
                    }
                    FilterChip(
                        selected = !occupied && time == value,
                        onClick = { if (!occupied) time = value },
                        enabled = !occupied,
                        label = {
                            Text(if (occupied) "$value · ocupada" else value)
                        },
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(date, time, room) }) {
                Text("Enviar solicitud")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
private fun BookingCard(
    request: BookingRequest,
    action: String? = null,
    onAction: () -> Unit = {},
) {
    AppCard {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(request.clientName, fontWeight = FontWeight.Bold)
                Text(
                    "${request.type} · ${request.duration} min",
                    color = Muted,
                    fontSize = 12.sp,
                )
                Text(request.requestedDate, color = Muted, fontSize = 12.sp)
            }
            StatusPill(request.status.label, bookingStatusColor(request.status))
        }
        Text("Entrenador: ${request.trainerName}", color = Muted, fontSize = 12.sp)
        request.proposedTime?.let {
            Text("Hora propuesta: $it", color = Warning, fontWeight = FontWeight.Bold)
        }
        action?.let {
            OutlinedButton(onClick = onAction, modifier = Modifier.fillMaxWidth()) {
                Text(it)
            }
        }
    }
}

@Composable
private fun RoomCard(room: Room) {
    AppCard {
        Row {
            Column(Modifier.weight(1f)) {
                Text(room.name, fontWeight = FontWeight.Bold)
                Text(room.use, color = Muted, fontSize = 12.sp)
            }
            Text(
                "${room.occupied}/${room.capacity}",
                color = if (room.occupied.toFloat() / room.capacity >= .75f) ActivateRedLight
                else Success,
                fontWeight = FontWeight.Bold,
            )
        }
        LinearProgressIndicator(
            progress = { room.occupied.toFloat() / room.capacity },
            modifier = Modifier.fillMaxWidth(),
            color = ActivateRed,
            trackColor = CardAlt,
        )
        Text("Próxima: ${room.nextUse}", color = Muted, fontSize = 12.sp)
    }
}

@Composable
private fun CycleScreen(store: AppStore) {
    var flow by remember { mutableStateOf("Sin flujo") }
    var symptoms by remember { mutableStateOf(setOf<String>()) }
    var notes by remember { mutableStateOf("") }
    var sharing by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf(false) }
    val symptomOptions = listOf("Dolor", "Fatiga", "Hinchazón", "Buen ánimo")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenHeader("Bienestar", "Mi ciclo", "Registro privado y bajo tu control")
        SectionTitle("Flujo")
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("Sin flujo", "Ligero", "Medio", "Intenso").forEach {
                FilterChip(
                    selected = flow == it,
                    onClick = { flow = it },
                    label = { Text(it, fontSize = 10.sp) },
                )
            }
        }
        AppCard {
            Text("¿Cómo te sientes?", fontWeight = FontWeight.Bold)
            symptomOptions.forEach { symptom ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            symptoms = if (symptom in symptoms) symptoms - symptom
                            else symptoms + symptom
                        },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(
                        checked = symptom in symptoms,
                        onCheckedChange = null,
                    )
                    Text(symptom)
                }
            }
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notas privadas") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        AppCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Compartir resumen con mis entrenadores", fontWeight = FontWeight.Bold)
                    Text("Las notas privadas nunca se comparten.", color = Muted, fontSize = 12.sp)
                }
                Switch(
                    checked = sharing,
                    onCheckedChange = { sharing = it },
                    colors = SwitchDefaults.colors(checkedTrackColor = ActivateRed),
                )
            }
        }
        Button(
            onClick = {
                store.saveCycleEntry(flow, symptoms, notes, sharing)
                saved = true
            },
            modifier = Modifier.fillMaxWidth().height(50.dp),
        ) {
            Text(if (saved) "Registro guardado" else "Guardar registro")
        }
        Text(
            "Este registro de salud sólo se guarda en tu cuenta de Firebase.",
            color = Muted,
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun ChatScreen(store: AppStore) {
    var text by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        ScreenHeader("Comunicación", "Chat", "Conversación privada con el equipo Activate")
        Spacer(Modifier.height(14.dp))
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(store.messages) { message ->
                Surface(
                    color = if (message.startsWith("Tú")) ActivateRed.copy(alpha = .2f) else Card,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(message, modifier = Modifier.padding(12.dp), fontSize = 13.sp)
                }
            }
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text("Escribe un mensaje") },
                modifier = Modifier.weight(1f),
                maxLines = 3,
            )
            Button(onClick = {
                store.sendMessage(text)
                text = ""
            }) {
                Text("Enviar")
            }
        }
    }
}

@Composable
private fun NutritionScreen() {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            ScreenHeader(
                "Seguimiento",
                "Nutrición",
                "Plan publicado por tu profesional",
            )
        }
        item {
            EmptyCard(
                "Sin plan publicado",
                "Cuando tu profesional publique un plan en Firebase aparecerá aquí.",
            )
        }
    }
}

@Composable
private fun PackScreen(store: AppStore, role: Role) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenHeader(
            role.label,
            "Pack de sesiones",
            "Consulta de consumo · pagos fuera de la app",
        )
        if (role == Role.CLIENT || role == Role.RESERVE) {
            AppCard {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(store.packName, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text("${store.packDuration} minutos por sesión", color = Muted)
                    }
                    Text(
                        "${store.remainingSessions}",
                        fontSize = 42.sp,
                        fontWeight = FontWeight.Black,
                        color = ActivateRedLight,
                    )
                }
                LinearProgressIndicator(
                    progress = {
                        if (store.packTotalSessions == 0) 0f
                        else store.usedSessions.toFloat() / store.packTotalSessions
                    },
                    modifier = Modifier.fillMaxWidth(),
                    trackColor = CardAlt,
                )
                Text(
                    "${store.usedSessions} utilizadas · ${store.reservedSessions} reservadas · " +
                        "${store.packTotalSessions} en total",
                    color = Muted,
                    fontSize = 12.sp,
                )
            }
            InfoCard(
                "Próxima disponible",
                "Sesión ${store.usedSessions + store.reservedSessions + 1} " +
                    "de ${store.packTotalSessions}",
            )
            InfoCard("Pagos", "No disponibles en la app")
        } else {
            InfoCard("Centro", "1 centro piloto")
            InfoCard("Duraciones", "45 o 60 minutos según el pack")
            InfoCard("Cobro", "Gestionado fuera de la aplicación")
        }
    }
}

@Composable
private fun ProfileScreen(store: AppStore, role: Role) {
    var notifications by remember { mutableStateOf(true) }
    var showTerms by remember { mutableStateOf(false) }
    val name = store.userName
    val email = store.userEmail

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { ScreenHeader(role.label, "Perfil", "Cuenta, consentimientos y preferencias") }
        item {
            AppCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(62.dp)
                            .background(ActivateRed, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            name.split(" ").take(2).joinToString("") { it.first().toString() },
                            fontWeight = FontWeight.Black,
                            fontSize = 20.sp,
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(name, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                        Text(email, color = Muted, fontSize = 12.sp)
                    }
                }
            }
        }
        if (role == Role.CLIENT || role == Role.RESERVE) {
            item { SectionTitle("Pack y consentimientos") }
            if (role == Role.CLIENT) {
                item {
                    InfoCard(
                        "Entrenadores",
                        store.trainerNames.joinToString().ifEmpty { "Sin asignar" },
                    )
                }
            }
            item { InfoCard("Pack", "${store.remainingSessions} sesiones disponibles") }
            if (role == Role.CLIENT) {
                item {
                    InfoCard(
                        "Titular",
                        if (store.isMinor) "Menor con responsable legal" else "Persona adulta",
                    )
                }
            }
            item {
                InfoCard(
                    "Términos",
                    if (store.termsAccepted) "Aceptados" else "Pendientes de aceptación",
                )
            }
            item {
                OutlinedButton(
                    onClick = { showTerms = true },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Consultar términos del piloto")
                }
            }
        }
        if (role == Role.BOSS) {
            item { SectionTitle("Equipo y colaboradores", store.staff.size) }
            items(store.staff) { member -> InfoCard(member.role, member.name) }
        }
        item { SectionTitle("Preferencias") }
        item {
            AppCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Notificaciones", modifier = Modifier.weight(1f))
                    Switch(
                        checked = notifications,
                        onCheckedChange = { notifications = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = ActivateRed),
                    )
                }
                HorizontalDivider(color = CardAlt)
                Text("Idioma · Español", color = Muted)
                HorizontalDivider(color = CardAlt)
                Text("Privacidad y salud · acceso restringido", color = Muted)
            }
        }
        item {
            OutlinedButton(
                onClick = store::logout,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) {
                Text("Cerrar sesión")
            }
        }
    }

    if (showTerms) {
        TermsDialog(store = store, onDismiss = { showTerms = false })
    }
}

@Composable
private fun TermsDialog(store: AppStore, onDismiss: () -> Unit) {
    var acceptsTerms by remember { mutableStateOf(store.termsAccepted) }
    var imageConsent by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Términos del piloto") },
        text = {
            Column(
                modifier = Modifier.fillMaxHeight(.7f).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    "BORRADOR PENDIENTE DE REVISIÓN LEGAL",
                    color = Warning,
                    fontWeight = FontWeight.Bold,
                )
                TermsLine("1", "Las sesiones son personales y no pueden cederse sin autorización.")
                TermsLine("2", "Con más de 24 horas se puede reorganizar sin perder la sesión.")
                TermsLine("3", "Con menos de 4 horas la sesión se contabiliza.")
                TermsLine("4", "La regla entre 4 y 24 horas debe ser confirmada por Activate.")
                TermsLine("5", "Los menores necesitan consentimiento de su responsable legal.")
                TermsLine("6", "El uso de imagen se autoriza o rechaza por separado.")
                if (!store.termsAccepted) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = acceptsTerms,
                            onCheckedChange = { acceptsTerms = it },
                        )
                        Text("Acepto los términos y condiciones")
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = imageConsent,
                            onCheckedChange = { imageConsent = it },
                        )
                        Text("Autorizo el uso de mi imagen")
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (!store.termsAccepted) store.acceptTerms(imageConsent)
                    onDismiss()
                },
                enabled = store.termsAccepted || acceptsTerms,
            ) {
                Text(if (store.termsAccepted) "Cerrar" else "Aceptar")
            }
        },
    )
}

@Composable
private fun TermsLine(number: String, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(color = ActivateRed, shape = CircleShape) {
            Box(Modifier.size(26.dp), contentAlignment = Alignment.Center) {
                Text(number, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        Text(text, fontSize = 13.sp, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun ScreenHeader(eyebrow: String, title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(
            eyebrow.uppercase(),
            color = ActivateRedLight,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
        Text(title, fontSize = 30.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, color = Muted, fontSize = 13.sp)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
}

@Composable
private fun SectionTitle(text: String, count: Int? = null) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(text, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        count?.let {
            Surface(color = ActivateRed.copy(alpha = .14f), shape = CircleShape) {
                Text(
                    "$it",
                    color = ActivateRedLight,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun AppCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Card,
        modifier = Modifier.fillMaxWidth().border(
            1.dp,
            Color.White.copy(alpha = .06f),
            RoundedCornerShape(16.dp),
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = content,
        )
    }
}

@Composable
private fun InfoCard(label: String, value: String) {
    AppCard {
        Text(label, color = Muted, fontSize = 12.sp)
        Text(value, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun EmptyCard(title: String, subtitle: String) {
    AppCard {
        Text(title, fontWeight = FontWeight.Bold)
        Text(subtitle, color = Muted, fontSize = 12.sp)
    }
}

@Composable
private fun StatusPill(label: String, color: Color) {
    Surface(color = color.copy(alpha = .14f), shape = CircleShape) {
        Text(
            label,
            color = color,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
        )
    }
}

private fun statusColor(status: SessionStatus): Color = when (status) {
    SessionStatus.CONFIRMED -> Success
    SessionStatus.COMPLETED -> Color(0xFF0A84FF)
    SessionStatus.CANCELLED -> Color(0xFFFF453A)
}

private fun bookingStatusColor(status: BookingStatus): Color = when (status) {
    BookingStatus.PENDING_TRAINER, BookingStatus.PENDING_BOSS -> Warning
    BookingStatus.CONFIRMED -> Success
    BookingStatus.REJECTED -> Color(0xFFFF453A)
}
