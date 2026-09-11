
import { jsPDF } from 'jspdf';
import fs from 'fs';

async function testPdfEncoding() {
    const doc = new jsPDF();
    
    // Standard fonts
    doc.setFont('helvetica', 'normal');
    doc.text('English: Hello World', 20, 20);
    
    // Polish (Latin Extended) - Should mostly work with standard fonts in some environments but let's see
    doc.text('Polish: Zażółć gęślą jaźń', 20, 30);
    
    // Non-Latin (Chinese)
    doc.text('Chinese: 你好世界', 20, 40);
    
    // Arabic
    doc.text('Arabic: مرحبا بالعالم', 20, 50);
    
    const buffer = doc.output('arraybuffer');
    fs.writeFileSync('encoding_test_result.pdf', Buffer.from(buffer));
    console.log('PDF encoding test completed. File saved to encoding_test_result.pdf');
}

testPdfEncoding();
