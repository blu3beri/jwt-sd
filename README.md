> [!CAUTION]
> This repository is deprecated. Please use [OWF Labs: sd-jwt-ts](https://github.com/openwallet-foundation-labs/sd-jwt-js)

# Selective Disclosure JWT (SD-JWT) Draft 06 & Selective Disclosure JWT VC 01

## Compliant with

-   [sd-jwt
    06](https://datatracker.ietf.org/doc/draft-ietf-oauth-selective-disclosure-jwt/06/)
-   [sd-jwt-vc
    01](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/01/)

## Design decisions

### Bring your own crypto

This library does not provide any of the cryptographic primitives required for
encryption, decryption, signing, verification and hashing. It is expected that
the user of this library provides this. The main reason for this is that most
libraries have their own library and KMS. Providing private keys to this
library adds another layer of insecurity which should be avoided. Hashing has
not been added for platform compatibility between node,js, browser and React
Native. In the future a platform-independent sha2-256 may be provided.

### Specification backwards compatibility

Since these specifications are in early drafts, no time will be spend in
supporting earlier versions of the specifications. This library may work for
older versions, e.g. the addition of selectively disclosable items in an array
does not break previous implementations. Once a non-draft specification is
released it will stay up-to-date with that version.

### Dependencies

This library only has one dependency on `buffer` which makes sure this library
works in Node.js, the browser and React Native. Buffer is used internally for
`base64-url-no-pad` encoding.

### Usage

I'd highly recommend to check out the [examples folder](examples) to see how
this library can be leveraged.

### Issuance API

The issuance API takes an object called a `disclosureFrame`. This
`disclosureFrame` is a Boolean Map of the payload which allows you to specify
which attributes of the payload may be selectively disclosed. If an attribute is not provided in the `disclosureFrame`, it will be included in the clear-text payload. For example:

```jsonc
// The payload
{
    "iss": "https://example.org/issuer",
    "is_age_over_21": true,
    "is_age_over_24": true,
    "is_age_over_65": false,
    "date_of_birth": "1990-01-01",
    "address": {
        "street": "some street",
        "house_number": 200,
        "zipcode": "2344GH"
    }
}
```

```jsonc
// The disclosure frame
{
    "is_age_over_21": true,
    "is_age_over_24": true,
    "is_age_over_65": true,
    "date_of_birth": true,
    "address": {
        "street": true,
        "house_number": true,
        "zipcode": true
    }
}

// or to only disclose the address as a group
{
    "is_age_over_21": true,
    "is_age_over_24": true,
    "is_age_over_65": true,
    "date_of_birth": true,
    "address": true
}
```

### Presentation and verification API

Since there is officially standardized way to request and present a
presentation, [High Assurance Interoperability
Profile](https://vcstuff.github.io/oid4vc-haip-sd-jwt-vc/draft-oid4vc-haip-sd-jwt-vc.html)
may be used, the API is defined in a way which works in a primitive manner for
now. For example, to present you can provide a list of indices of the
disclosures which will be included. Examples of this can be found in the
[examples folder](examples). For verification a list of keys or required
claims can be provided. It does not matter whether these are selectively
disclosable claims, or if they are included inside the payload.
