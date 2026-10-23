-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL FAMILY / KATEGORI PRODUK
CREATE TABLE product_families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL, -- Contoh: ACC, VCR, PPOB
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('FISIK', 'JASA')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL PRODUK & STOK (FISIK & JASA)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    family_id UUID REFERENCES product_families(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('FISIK', 'JASA')),
    hpp NUMERIC(15, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0, -- Untuk JASA bisa diabaikan/diisi 0
    min_stock INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEQUENCE & LOGIC AUTO-INCREMENT SKU BERDASARKAN KODE FAMILY
CREATE SEQUENCE IF NOT EXISTS sku_sequence START 1001;

CREATE OR REPLACE FUNCTION generate_sku()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
BEGIN
    SELECT code INTO prefix FROM product_families WHERE id = NEW.family_id;
    IF prefix IS NULL THEN
        prefix := 'GEN';
    END IF;
    NEW.sku := prefix || '-' || LPAD(nextval('sku_sequence')::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_sku
BEFORE INSERT ON products
FOR EACH ROW
WHEN (NEW.sku IS NULL OR NEW.sku = '')
EXECUTE FUNCTION generate_sku();

-- 4. TABEL TRANSAKSI PENJUALAN
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(100) DEFAULT 'Umum',
    total_hpp NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_profit NUMERIC(15, 2) GENERATED ALWAYS AS (total_amount - total_hpp) STORED,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('TUNAI', 'TRANSFER', 'QRIS', 'PIUTANG')),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PENDING', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DETAIL TRANSAKSI
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(150) NOT NULL,
    qty INT NOT NULL CHECK (qty > 0),
    hpp NUMERIC(15, 2) NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    subtotal NUMERIC(15, 2) GENERATED ALWAYS AS (qty * price) STORED,
    subtotal_hpp NUMERIC(15, 2) GENERATED ALWAYS AS (qty * hpp) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRIGGER UPDATE STOK SAAT TRANSAKSI TERJADI (HANYA PRODUK FISIK)
CREATE OR REPLACE FUNCTION handle_stock_reduction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET stock = stock - NEW.qty,
        updated_at = NOW()
    WHERE id = NEW.product_id AND type = 'FISIK';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_reduction
AFTER INSERT ON transaction_items
FOR EACH ROW
EXECUTE FUNCTION handle_stock_reduction();

-- 6. TABEL MANAJEMEN PIUTANG
CREATE TABLE receivables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    debtor_name VARCHAR(100) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    remaining_amount NUMERIC(15, 2) NOT NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'BELUM_LUNAS' CHECK (status IN ('BELUM_LUNAS', 'LUNAS')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL CASH COUNT (CLOSING KAS HARIAN)
CREATE TABLE cash_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opened_by VARCHAR(100) NOT NULL,
    opening_cash NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expected_closing_cash NUMERIC(15, 2) NOT NULL DEFAULT 0,
    actual_closing_cash NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discrepancy NUMERIC(15, 2) GENERATED ALWAYS AS (actual_closing_cash - expected_closing_cash) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. INDEKS UNTUK OPTIMASI LAPORAN
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_receivables_status ON receivables(status);