
function AudioBufferListNode() {
    this.prev = null;
    this.next = null;
    this.buffer = null;
    this.indexInBuffer = 0;
}

AudioBufferListNode.prototype = {

    getAvailableByteCount: function () {
        return this.buffer.length - this.indexInBuffer;
    },

    popBytes: function (count) {
        
        if (count > this.getAvailableByteCount()) {
            console.log('Available bytes is less then count');
            return null;
        }
        
        var startIndex = this.indexInBuffer;
        this.indexInBuffer += count;

        return this.buffer.slice(startIndex, startIndex + count);
    },
    
    reset: function() {
        this.perv = null;
        this.next = null;
        this.indexInBuffer = null;
        this.buffer = null;
    }
};


function AudioBufferList() {
    
    this.first = null;
    this.last = null;
    
    this.recycledNodes = [];
}

AudioBufferList.prototype = {

    putData: function (buffer) {

        var node = this.createNode();
        node.buffer = buffer;
        
        if (this.last) {
            this.last.next = node;
            node.prev = this.last;
            this.last = node;
        } else {
            this.first = this.last = node;
        }
    },

    loadDataTo: function (buffer) {
        
        if (!this.first) {
//            console.log('Need audio!!! all');
           buffer.fill(0);
           return;
        }

        var bytes = 0;
        var length = buffer.length;

        while (bytes < length && this.first) {
            var len = Math.min(this.first.getAvailableByteCount(), length - bytes);
            
            if (len > 0) {
                var subbuf = this.first.popBytes(len);
                buffer.set(subbuf, bytes);
                bytes += len;
            }

            if (this.first.getAvailableByteCount() === 0) {
                this.removeFirst();
            }
        }

        if (bytes < length) {
            console.log('Need audio!!! ' + (length - bytes));
        }

        return buffer;
    },

    clear: function () {
        this.first = this.last = null;
    },
    
    removeFirst: function () {
        if (this.first) {
            this.recycledNodes.push(this.first);
            this.first = this.first.next;

            if (this.first) {
                this.first.prev = null;
            } else {
                this.last = null;
            }
        }
    },
    
    createNode: function() {
        if (this.recycledNodes.length > 0) {
            var node = this.recycledNodes.pop();
            node.reset();
            return node;
        }
        
        return new AudioBufferListNode();
    }
};