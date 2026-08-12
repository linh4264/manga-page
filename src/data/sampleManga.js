/**
 * Sample Manga Catalog with Google Drive & direct CDN image links.
 * Users can read these out-of-the-box or add their custom manga via Google Drive.
 */

window.SAMPLE_MANGA_DATA = [
  {
    id: 'solo-leveling',
    title: 'Solo Leveling (Tôi Thăng Cấp Một Mình)',
    originalTitle: 'Solo Leveling - 나 혼자만 Level Up',
    author: 'Chugong / DUBU (REDICE STUDIO)',
    artist: 'DUBU',
    status: 'Hoàn thành',
    coverDriveId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    coverUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80',
    description: '10 năm trước, sau khi "Cánh cổng" kết nối thế giới loài người và thế giới quái vật mở ra, những con người bình thường đã nhận được sức mạnh thức tỉnh. Sung Jin-Woo là một Thợ săn cấp E yếu nhất...',
    genres: ['Action', 'Fantasy', 'Manhwa', 'Shounen', 'Supernatural'],
    rating: 4.9,
    views: '2.5M',
    chapters: [
      {
        id: 'chap-1',
        title: 'Chương 1: Thợ Săn Yếu Nhất Thế Giới',
        updatedAt: '2026-08-10',
        pages: [
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1563089145-599997674d42?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1000&auto=format&fit=crop&q=80'
        ]
      },
      {
        id: 'chap-2',
        title: 'Chương 2: Ngôi Đền Đôi',
        updatedAt: '2026-08-11',
        pages: [
          'https://images.unsplash.com/photo-1563089145-599997674d42?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1000&auto=format&fit=crop&q=80'
        ]
      },
      {
        id: 'chap-3',
        title: 'Chương 3: Điều Luật Thứ Ba',
        updatedAt: '2026-08-12',
        pages: [
          'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80'
        ]
      }
    ]
  },
  {
    id: 'cyberpunk-chronicles',
    title: 'Cyberpunk Chronicles (Huyền Thoại Tương Lai)',
    originalTitle: 'Cyberpunk Chronicles: Neon City',
    author: 'Alex Mercer',
    artist: 'Kaito Studio',
    status: 'Đang tiến hành',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
    description: 'Thế giới năm 2099 nơi công nghệ sinh học và trí tuệ nhân tạo thống trị con người. Một hacker trẻ vô tình phát hiện ra bí mật đen tối của tập đoàn công nghệ lớn nhất hành tinh...',
    genres: ['Sci-Fi', 'Cyberpunk', 'Action', 'Mystery'],
    rating: 4.8,
    views: '1.8M',
    chapters: [
      {
        id: 'chap-1',
        title: 'Chương 1: Ánh Đèn Neon Đêm',
        updatedAt: '2026-08-08',
        pages: [
          'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1000&auto=format&fit=crop&q=80'
        ]
      },
      {
        id: 'chap-2',
        title: 'Chương 2: Mã Độc Tối Thượng',
        updatedAt: '2026-08-09',
        pages: [
          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1000&auto=format&fit=crop&q=80'
        ]
      }
    ]
  },
  {
    id: 'drive-custom-demo',
    title: 'Demo Google Drive Drive-Links',
    originalTitle: 'Google Drive Manga Integration Test',
    author: 'GG Drive Reader Admin',
    artist: 'Google Cloud API',
    status: 'Đang tiến hành',
    coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80',
    description: 'Bộ truyện mẫu kiểm thử kết nối trực tiếp với Google Drive Image IDs. Bạn có thể tự dán liên kết Google Drive của chính mình thông qua nút "+ Thêm Truyện Drive".',
    genres: ['Google Drive', 'Webtoon', 'Slice of Life'],
    rating: 5.0,
    views: '500K',
    chapters: [
      {
        id: 'chap-1',
        title: 'Chương 1: Kiểm thử Google Drive CDN',
        updatedAt: '2026-08-12',
        // Drive IDs or URLs will be processed seamlessly by DriveHelper
        pages: [
          '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80'
        ]
      }
    ]
  }
];
