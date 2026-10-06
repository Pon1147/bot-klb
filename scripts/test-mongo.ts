import dotenv from 'dotenv';
dotenv.config();

import { connectMongo, disconnectMongo, isMongoConnected } from '../src/database/mongo/index.js';

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

  console.log('\n=============================================');
  console.log('   KIỂM TRA KẾT NỐI MONGODB TỪ LOCAL');
  console.log('=============================================\n');

  if (!uri) {
    console.error('❌ Không tìm thấy biến môi trường MONGODB_URI hoặc MONGO_URL trong file .env');
    console.log('👉 Vui lòng thêm MONGODB_URI=... vào file .env của bạn.\n');
    process.exit(1);
  }

  // Cảnh báo nếu chứa placeholder của Railway
  if (uri.includes('${{')) {
    console.error('⚠️  Phát hiện URI chứa placeholder của Railway: "${{...}}"');
    console.log('   Biến này chỉ có tác dụng nội bộ trên Railway, máy local không thể phân giải.\n');
    process.exit(1);
  }

  // Ẩn mật khẩu khi hiển thị log
  const maskedUri = uri.replace(/:([^@]+)@/, ':****@');
  console.log(`📡 Đang thử kết nối tới: ${maskedUri} ...`);

  try {
    const db = await connectMongo(uri);
    if (!db || !isMongoConnected()) {
      console.error('❌ Không thể khởi tạo kết nối MongoDB.');
      process.exit(1);
    }

    console.log(`\n✅ KẾT NỐI THÀNH CÔNG!`);
    console.log(`   Database Name : "${db.databaseName}"`);

    const collections = await db.listCollections().toArray();
    console.log(`   Collections hiện có (${collections.length}):`);
    if (collections.length === 0) {
      console.log('   - (Chưa có collection nào - database mới)');
    } else {
      collections.forEach((col) => console.log(`   - ${col.name}`));
    }

    await disconnectMongo();
    console.log('\n🔌 Đã đóng kết nối an toàn.');
    console.log('=============================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ KẾT NỐI THẤT BẠI:');
    console.error(`   ${error?.message || error}`);
    console.log('\n💡 Gợi ý khắc phục:');
    console.log('   - Kiểm tra xem Railway MongoDB đã bật Public Networking (TCP Proxy) chưa.');
    console.log('   - Kiểm tra username / password trong connection string có chính xác không.\n');
    process.exit(1);
  }
}

main();
