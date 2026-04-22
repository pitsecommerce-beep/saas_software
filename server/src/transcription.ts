import OpenAI from 'openai';

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export async function transcribeAudio(
  audio: { id?: string; link?: string; mime_type?: string },
  recipientPhone: string
): Promise<string | null> {
  try {
    let audioUrl = audio.link;

    if (!audioUrl && audio.id) {
      const ycloudKey = process.env.YCLOUD_API_KEY;
      if (!ycloudKey) {
        console.warn('[Transcription] YCLOUD_API_KEY not configured, cannot fetch media URL');
        return null;
      }
      const mediaRes = await fetch(`https://api.ycloud.com/v2/whatsapp/media/${audio.id}`, {
        method: 'GET',
        headers: { 'X-API-Key': ycloudKey },
      });
      if (!mediaRes.ok) {
        console.warn(`[Transcription] Failed to fetch media metadata for ${audio.id} (recipient=${recipientPhone}): ${mediaRes.status}`);
        return null;
      }
      const mediaData = (await mediaRes.json()) as { url?: string };
      audioUrl = mediaData.url;
    }

    if (!audioUrl) {
      console.warn('[Transcription] No audio URL available');
      return null;
    }

    const downloadRes = await fetch(audioUrl);
    if (!downloadRes.ok) {
      console.warn(`[Transcription] Failed to download audio: ${downloadRes.status}`);
      return null;
    }
    const buffer = Buffer.from(await downloadRes.arrayBuffer());

    if (buffer.length > MAX_AUDIO_BYTES) {
      console.warn(`[Transcription] Audio file too large: ${buffer.length} bytes (max ${MAX_AUDIO_BYTES})`);
      return null;
    }

    const openaiKey = process.env.OPENAI_TRANSCRIPTION_KEY;
    if (!openaiKey) {
      console.warn('[Transcription] OPENAI_TRANSCRIPTION_KEY not configured. Set it in Railway Dashboard → your backend service → Variables.');
      return null;
    }

    const client = new OpenAI({ apiKey: openaiKey });
    const file = new File([buffer], 'audio.ogg', { type: audio.mime_type || 'audio/ogg' });

    const transcription = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'es',
    });

    const text = transcription.text?.trim();
    return text ? text : null;
  } catch (err) {
    console.error('[Transcription] Error:', err);
    return null;
  }
}
