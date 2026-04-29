// Prism AAC — Wear OS Companion App (Samsung Galaxy Watch / Pixel Watch)
// Quick phrase buttons for wrist-level communication
// Jetpack Compose for Wear OS (API 30+)

package ai.synalux.prismaac.wear

import android.os.Bundle
import android.speech.tts.TextToSpeech
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.*
import java.util.Locale

data class PhraseCategory(
    val id: String,
    val name: String,
    val icon: String,
    val phrases: List<String>
)

val categories = listOf(
    PhraseCategory("help", "Help", "🆘", listOf("I need help", "Yes", "No", "All done", "Bathroom", "I am hungry", "I am thirsty", "Take a break")),
    PhraseCategory("talk", "Talk", "💬", listOf("Hello", "Thank you", "Please", "Goodbye", "Sorry", "Excuse me", "How are you?", "Wait")),
    PhraseCategory("food", "Food", "🍽️", listOf("Water", "Juice", "Pizza", "I would like to order", "Check please", "Fries", "Sandwich")),
    PhraseCategory("places", "Places", "📍", listOf("Home", "School", "Park", "Restaurant", "Library", "Mall", "Car")),
    PhraseCategory("people", "People", "👥", listOf("Mom", "Dad", "Teacher", "Friend", "Doctor", "Family")),
)

class MainActivity : ComponentActivity() {
    private lateinit var tts: TextToSpeech

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts.language = Locale.US
                tts.setSpeechRate(0.6f)
            }
        }

        setContent {
            PrismAACWearApp(onSpeak = { text ->
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "prism-aac")
            })
        }
    }

    override fun onDestroy() {
        tts.shutdown()
        super.onDestroy()
    }
}

@Composable
fun PrismAACWearApp(onSpeak: (String) -> Unit) {
    var selectedCategory by remember { mutableStateOf<PhraseCategory?>(null) }
    var lastSpoken by remember { mutableStateOf("") }

    MaterialTheme(
        colors = Colors(
            primary = Color(0xFF8B5CF6),
            onPrimary = Color.White,
            surface = Color(0xFF0A0A1A),
            onSurface = Color(0xFFE2E8F0),
            background = Color(0xFF0A0A1A),
            onBackground = Color(0xFFE2E8F0),
        )
    ) {
        if (selectedCategory != null) {
            PhraseList(
                category = selectedCategory!!,
                onSpeak = { text ->
                    onSpeak(text)
                    lastSpoken = text
                },
                onBack = { selectedCategory = null }
            )
        } else {
            CategoryList(
                onSelect = { selectedCategory = it },
                onSpeak = { text ->
                    onSpeak(text)
                    lastSpoken = text
                },
                lastSpoken = lastSpoken
            )
        }
    }
}

@Composable
fun CategoryList(
    onSelect: (PhraseCategory) -> Unit,
    onSpeak: (String) -> Unit,
    lastSpoken: String
) {
    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Text(
                "Prism AAC",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF8B5CF6),
                textAlign = TextAlign.Center
            )
        }

        if (lastSpoken.isNotEmpty()) {
            item {
                Text(
                    "🔊 $lastSpoken",
                    fontSize = 10.sp,
                    color = Color(0xFF64748B),
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White.copy(alpha = 0.05f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }

        // Quick emergency row
        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                QuickChip("Help", Color(0xFFEF4444), Modifier.weight(1f)) { onSpeak("Help") }
                QuickChip("Yes", Color(0xFF10B981), Modifier.weight(1f)) { onSpeak("Yes") }
                QuickChip("No", Color(0xFFF59E0B), Modifier.weight(1f)) { onSpeak("No") }
            }
        }

        items(categories) { cat ->
            Chip(
                onClick = { onSelect(cat) },
                label = { Text("${cat.icon} ${cat.name}", fontWeight = FontWeight.Bold) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                colors = ChipDefaults.chipColors(
                    backgroundColor = Color.White.copy(alpha = 0.08f)
                )
            )
        }
    }
}

@Composable
fun PhraseList(
    category: PhraseCategory,
    onSpeak: (String) -> Unit,
    onBack: () -> Unit
) {
    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            CompactChip(
                onClick = onBack,
                label = { Text("← Back", fontSize = 11.sp) },
                colors = ChipDefaults.chipColors(backgroundColor = Color.Transparent)
            )
        }

        item {
            Text(
                "${category.icon} ${category.name}",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        items(category.phrases) { phrase ->
            Chip(
                onClick = { onSpeak(phrase) },
                label = { Text(phrase, fontWeight = FontWeight.SemiBold) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                colors = ChipDefaults.chipColors(
                    backgroundColor = Color(0xFF8B5CF6).copy(alpha = 0.3f)
                )
            )
        }
    }
}

@Composable
fun QuickChip(text: String, color: Color, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.3f))
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
    }
}
