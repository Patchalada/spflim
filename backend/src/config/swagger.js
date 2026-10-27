const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dormitory Management System API',
      version: '1.0.0',
      description: 'เอกสารและระบบทดสอบ API สำหรับระบบบริหารจัดการหอพัก (วิชาปัญหาพิเศษ)',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // ชี้ไปที่ไฟล์ routes ทุกไฟล์ที่มี Annotations
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;