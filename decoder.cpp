#include <opus.h>
#include <speex_resampler.h>

// #include <stdio.h>
#include <stdlib.h>
#include <string.h>
// #include <limits.h>
#include <inttypes.h>

#include <emscripten.h>
// #include <time.h>
#include <math.h>


struct OpusDecoder {
    SpeexResamplerState * resampler;
    OpusDecoder * decoder;

    unsigned int decoderOutputMaxLength;
    float * decoderOutputBuffer;

    unsigned int resampleOutputMaxLength;
    float * resamplerOutputBuffer;

    int inSampleRate;
    int outSampleRate;
    int channelNumber;
};



extern "C"
void * open_decoder(int inSampleRate, int outSampleRate, int channelNumber) {
    int err;

    SpeexResamplerState * resampler = speex_resampler_init(channelNumber, inSampleRate, outSampleRate, 3, &err);

    if (err < 0) {
        emscripten_log(EM_LOG_CONSOLE, "resampler initialize failed %d\n", err);
        return NULL;
    }

    OpusDecoder * decoder = opus_decoder_create(inSampleRate, channelNumber, &err);
    if (err < 0) {
        speex_resampler_destroy(resampler);
        emscripten_log(EM_LOG_CONSOLE, "decoder initialize failed %d\n", err);
        return NULL;
    }

    OpusDecoder * opus = (OpusDecoder *)malloc(sizeof(OpusDecoder));

    opus->inSampleRate = inSampleRate;
    opus->outSampleRate = outSampleRate;
    opus->channelNumber = channelNumber;


    emscripten_log(EM_LOG_CONSOLE, "Audio decoder initialized %d, %d, %d\n", inSampleRate, outSampleRate, channelNumber);
    
    opus->decoder = decoder;
    opus->resampler = resampler;

    opus->decoderOutputMaxLength = inSampleRate * channelNumber * 120 / 1000;
    opus->decoderOutputBuffer = (float *) malloc(sizeof(float) * opus->decoderOutputMaxLength);

    opus->resampleOutputMaxLength = ceil(opus->decoderOutputMaxLength * outSampleRate / inSampleRate);
    opus->resamplerOutputBuffer = (float *) malloc(sizeof(float) * opus->resampleOutputMaxLength);
    return opus;
}


extern "C"
void close_decoder(void * dec) {
    
    if (dec) {
        OpusDecoder * opus = (OpusDecoder*)dec;

        free(opus->decoderOutputBuffer);
        free(opus->resamplerOutputBuffer);
        opus_decoder_destroy(opus->decoder);
        speex_resampler_destroy(opus->resampler);

        free(opus);
    }
}

extern "C"
int decode_samples(int id, void * dec, unsigned char const * nal, int nalsz) {
    OpusDecoder * opus = (OpusDecoder*)dec;
    int decodedSampleLength = opus_decode_float(opus->decoder, nal, nalsz, opus->decoderOutputBuffer, opus->decoderOutputMaxLength, 0);

    if (decodedSampleLength < 0) {
        emscripten_log(EM_LOG_CONSOLE, "decode failed %d\n", decodedSampleLength);
        return decodedSampleLength;
    }

    // emscripten_log(EM_LOG_CONSOLE, "Audio decoded %d, [0] = %g\n", decodedSampleLength, opus->decoderOutputBuffer[0]);

    int resampledLength = ceil(decodedSampleLength * opus->outSampleRate / opus->inSampleRate);
    int ret = speex_resampler_process_interleaved_float(
        opus->resampler, opus->decoderOutputBuffer, (spx_uint32_t *) &decodedSampleLength, 
        opus->resamplerOutputBuffer, (spx_uint32_t *)&resampledLength);
    
    // emscripten_log(EM_LOG_CONSOLE, "Audio resampled %d, [0] = %g\n", resampledLength, opus->resamplerOutputBuffer[0]);

    if (ret < 0) {
        emscripten_log(EM_LOG_CONSOLE, "resample failed %d\n", ret);
        return ret;
    }


    int size = resampledLength * opus->channelNumber;
    // float data[size];
    // memcpy(data, opus->resamplerOutputBuffer, size * sizeof(float));

    EM_ASM_({
        decode_callback($0, $1, $2);
    },
        id,
        opus->resamplerOutputBuffer,
        size
    );

    return size;
}

#ifdef NATIVE
#include <sys/mman.h>
int main(int argc, char * argv[]) {
    void * h = open_decoder();
    emscripten_log(EM_LOG_CONSOLE, "ready to decode\n");
    close_decoder(h);
}
#endif
