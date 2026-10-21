// Tiny SMTP sink that captures emails sent by Supabase Auth during tests, plus an HTTP
// mailbox:  GET /messages  (newest last)   DELETE /messages  (clear).  TEST HARNESS ONLY.

import http from 'node:http';
import net from 'node:net';

const messages = [];

function decodeQuotedPrintable(s) {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

net
  .createServer((socket) => {
    let data = false;
    let buf = '';
    let current = { from: '', to: [], raw: '' };
    const reply = (line) => socket.write(line + '\r\n');
    reply('220 agrilink-test-smtp ready');
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      while (true) {
        if (data) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end === -1) return;
          current.raw = buf.slice(0, end);
          buf = buf.slice(end + 5);
          data = false;
          const raw = current.raw;
          const subject = (raw.match(/^Subject: (.*)$/im) ?? [])[1] ?? '';
          const body = decodeQuotedPrintable(raw.split(/\r?\n\r?\n/).slice(1).join('\n\n'));
          messages.push({ from: current.from, to: current.to, subject, body, receivedAt: new Date().toISOString() });
          current = { from: '', to: [], raw: '' };
          reply('250 OK: queued');
          continue;
        }
        const idx = buf.indexOf('\r\n');
        if (idx === -1) return;
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') reply('250 agrilink-test-smtp');
        else if (cmd === 'MAIL') { current.from = line.replace(/^MAIL FROM:\s*/i, ''); reply('250 OK'); }
        else if (cmd === 'RCPT') { current.to.push(line.replace(/^RCPT TO:\s*/i, '').replace(/[<>]/g, '')); reply('250 OK'); }
        else if (cmd === 'DATA') { data = true; reply('354 End data with <CR><LF>.<CR><LF>'); }
        else if (cmd === 'QUIT') { reply('221 Bye'); socket.end(); return; }
        else if (cmd === 'RSET') { current = { from: '', to: [], raw: '' }; reply('250 OK'); }
        else if (cmd === 'NOOP') reply('250 OK');
        else reply('250 OK');
      }
    });
  })
  .listen(Number(process.env.SMTP_PORT ?? 54325), '127.0.0.1');

http
  .createServer((req, res) => {
    if (req.method === 'DELETE') messages.length = 0;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(messages));
  })
  .listen(Number(process.env.MAILBOX_PORT ?? 54324), '127.0.0.1');
