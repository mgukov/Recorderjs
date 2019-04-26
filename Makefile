INPUT_DIR=./src
OUTPUT_DIR=./dist
EMCC_OPTS=-O3 --llvm-lto 1 --memory-init-file 0 -s NO_DYNAMIC_EXECUTION=1 -s NO_FILESYSTEM=1 -o $@ $^
DEFAULT_EXPORTS:='_free','_malloc', 'ccall', 'cwrap'


LIBOPUS_LIBOPUS=$(OUTPUT_DIR)/libopus.js

LIBOPUS_STABLE=tags/v1.3.1
LIBOPUS_DIR=./opus
LIBOPUS_OBJ=$(LIBOPUS_DIR)/.libs/libopus.a

LIBOPUS_ENCODER_EXPORTS:='_opus_encoder_create','_opus_encode_float','_opus_encoder_ctl'
LIBOPUS_DECODER_EXPORTS:='_opus_decoder_create','_opus_decode_float','_opus_decoder_destroy'
LIBOPUS_EXPORTS:='_open_decoder','_close_decoder','_decode_samples'

LIBSPEEXDSP_STABLE=tags/SpeexDSP-1.2rc3
LIBSPEEXDSP_DIR=./speexdsp
LIBSPEEXDSP_OBJ=$(LIBSPEEXDSP_DIR)/libspeexdsp/.libs/libspeexdsp.a
LIBSPEEXDSP_EXPORTS:='_speex_resampler_init','_speex_resampler_process_interleaved_float','_speex_resampler_destroy'

LIBOPUS_PUCK=libopus.wasm.js

default: $(LIBOPUS_PUCK)

$(LIBOPUS_PUCK): $(LIBOPUS_LIBOPUS) $(RECORDER)
	cat before.js dist/libopus.js after.js > dist/libopus.wasm.js
	rm dist/libopus.js

clean:
	rm -rf $(OUTPUT_DIR) $(LIBOPUS_DIR) $(LIBSPEEXDSP_DIR)
	mkdir $(OUTPUT_DIR)

$(LIBOPUS_DIR)/autogen.sh:
	git submodule update --init --recursive
	cd $(LIBOPUS_DIR); git checkout ${LIBOPUS_STABLE}

$(LIBSPEEXDSP_DIR)/autogen.sh:
	git submodule update --init --recursive
	cd $(LIBSPEEXDSP_DIR); git checkout ${LIBSPEEXDSP_STABLE}

$(LIBOPUS_OBJ): $(LIBOPUS_DIR)/autogen.sh
	cd $(LIBOPUS_DIR); ./autogen.sh
	cd $(LIBOPUS_DIR); emconfigure ./configure --disable-extra-programs --disable-doc --disable-intrinsics --disable-rtcd
	cd $(LIBOPUS_DIR); emmake make

$(LIBSPEEXDSP_OBJ): $(LIBSPEEXDSP_DIR)/autogen.sh
	cd $(LIBSPEEXDSP_DIR); ./autogen.sh
	cd $(LIBSPEEXDSP_DIR); emconfigure ./configure --disable-examples
	cd $(LIBSPEEXDSP_DIR); emmake make


$(LIBOPUS_LIBOPUS): decoder.cpp $(LIBOPUS_OBJ) $(LIBSPEEXDSP_OBJ)
	emcc -o $@ $(EMCC_OPTS) -s EXPORTED_FUNCTIONS="[$(LIBOPUS_EXPORTS)]" \
		-s EXTRA_EXPORTED_RUNTIME_METHODS="[$(DEFAULT_EXPORTS)]" \
		$(LIBOPUS_OBJ) $(LIBSPEEXDSP_OBJ) -Iopus/include -Ispeexdsp/include/speex
