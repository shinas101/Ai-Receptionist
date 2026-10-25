#!/usr/bin/env python3
"""
Automated SSL Certificate & Private Key Generator for ABC Health Care.
Generates a self-signed X.509 v3 certificate with Subject Alternative Names (SAN)
for local and IP-based HTTPS deployments (no domain required).
"""

import datetime
import ipaddress
from pathlib import Path
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

BASE_DIR = Path(__file__).resolve().parent.parent
SSL_DIR = BASE_DIR / "nginx" / "ssl"
CERT_FILE = SSL_DIR / "cert.pem"
KEY_FILE = SSL_DIR / "key.pem"


def generate_self_signed_cert():
    SSL_DIR.mkdir(parents=True, exist_ok=True)

    print("Generating 2048-bit RSA private key...")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Kerala"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "ABC Health Care"),
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])

    now = datetime.datetime.now(datetime.timezone.utc)
    # Valid for 5 years
    cert_builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=1825))
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.DNSName("*.localhost"),
                x509.DNSName("clinic.local"),
                x509.DNSName("host.docker.internal"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                x509.IPAddress(ipaddress.IPv4Address("0.0.0.0")),
            ]),
            critical=False,
        )
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
    )

    certificate = cert_builder.sign(
        private_key=private_key,
        algorithm=hashes.SHA256(),
    )

    # Save private key
    with open(KEY_FILE, "wb") as f:
        f.write(
            private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )

    # Save certificate
    with open(CERT_FILE, "wb") as f:
        f.write(certificate.public_bytes(serialization.Encoding.PEM))

    print(f"SSL certificate generated at: {CERT_FILE}")
    print(f"SSL private key generated at: {KEY_FILE}")
    print("Supports: localhost, *.localhost, 127.0.0.1, 0.0.0.0, clinic.local")


if __name__ == "__main__":
    generate_self_signed_cert()
