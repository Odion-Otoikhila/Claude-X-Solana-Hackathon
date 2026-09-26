/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/spacelock_escrow.json`.
 */
export type SpacelockEscrow = {
  "address": "D2viXu3qRxX8vaUQcEC92rEXxfkYES7ZyWQXzRAoU47u",
  "metadata": {
    "name": "spacelockEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "adminResolve",
      "discriminator": [
        90,
        215,
        29,
        95,
        17,
        61,
        118,
        229
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "booking"
          ]
        },
        {
          "name": "booking",
          "writable": true
        },
        {
          "name": "renter",
          "writable": true,
          "relations": [
            "booking"
          ]
        },
        {
          "name": "host",
          "writable": true,
          "relations": [
            "booking"
          ]
        }
      ],
      "args": [
        {
          "name": "renterAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelBooking",
      "discriminator": [
        139,
        162,
        116,
        202,
        78,
        140,
        139,
        90
      ],
      "accounts": [
        {
          "name": "renter",
          "writable": true,
          "signer": true,
          "relations": [
            "booking"
          ]
        },
        {
          "name": "booking",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "confirmMoveIn",
      "discriminator": [
        64,
        41,
        240,
        161,
        14,
        179,
        229,
        232
      ],
      "accounts": [
        {
          "name": "renter",
          "signer": true,
          "relations": [
            "booking"
          ]
        },
        {
          "name": "booking",
          "writable": true
        },
        {
          "name": "host",
          "writable": true,
          "relations": [
            "booking"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "createBooking",
      "discriminator": [
        19,
        223,
        181,
        90,
        124,
        206,
        73,
        169
      ],
      "accounts": [
        {
          "name": "renter",
          "writable": true,
          "signer": true
        },
        {
          "name": "booking",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  111,
                  107,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "renter"
              },
              {
                "kind": "arg",
                "path": "bookingId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bookingId",
          "type": "u64"
        },
        {
          "name": "host",
          "type": "pubkey"
        },
        {
          "name": "admin",
          "type": "pubkey"
        },
        {
          "name": "rentAmount",
          "type": "u64"
        },
        {
          "name": "depositAmount",
          "type": "u64"
        },
        {
          "name": "disputeWindowSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "flagDispute",
      "discriminator": [
        150,
        222,
        78,
        72,
        117,
        140,
        2,
        75
      ],
      "accounts": [
        {
          "name": "host",
          "signer": true,
          "relations": [
            "booking"
          ]
        },
        {
          "name": "booking",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "releaseDeposit",
      "discriminator": [
        64,
        87,
        121,
        32,
        104,
        72,
        160,
        185
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Anyone can call this once the dispute window has passed; they only pay the tx fee."
          ],
          "signer": true
        },
        {
          "name": "booking",
          "writable": true
        },
        {
          "name": "renter",
          "writable": true,
          "relations": [
            "booking"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "startMoveOut",
      "discriminator": [
        93,
        9,
        164,
        194,
        160,
        97,
        124,
        237
      ],
      "accounts": [
        {
          "name": "renter",
          "signer": true,
          "relations": [
            "booking"
          ]
        },
        {
          "name": "booking",
          "writable": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "booking",
      "discriminator": [
        147,
        50,
        61,
        138,
        208,
        21,
        254,
        156
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notCreated",
      "msg": "Booking must be in Created status"
    },
    {
      "code": 6001,
      "name": "notMovedIn",
      "msg": "Booking must be in MovedIn status"
    },
    {
      "code": 6002,
      "name": "notMovedOut",
      "msg": "Booking must be in MovedOut status"
    },
    {
      "code": 6003,
      "name": "notDisputed",
      "msg": "Booking must be in Disputed status"
    },
    {
      "code": 6004,
      "name": "disputeWindowClosed",
      "msg": "The dispute window has already closed"
    },
    {
      "code": 6005,
      "name": "disputeWindowActive",
      "msg": "The dispute window has not closed yet"
    },
    {
      "code": 6006,
      "name": "splitExceedsDeposit",
      "msg": "Renter split amount exceeds the escrowed deposit"
    }
  ],
  "types": [
    {
      "name": "booking",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "renter",
            "type": "pubkey"
          },
          {
            "name": "host",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "bookingId",
            "type": "u64"
          },
          {
            "name": "rentAmount",
            "type": "u64"
          },
          {
            "name": "depositAmount",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "bookingStatus"
              }
            }
          },
          {
            "name": "moveOutTs",
            "type": "i64"
          },
          {
            "name": "disputeWindowSecs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "bookingStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "created"
          },
          {
            "name": "movedIn"
          },
          {
            "name": "movedOut"
          },
          {
            "name": "disputed"
          },
          {
            "name": "completed"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "bookingSeed",
      "type": "bytes",
      "value": "[98, 111, 111, 107, 105, 110, 103]"
    }
  ]
};
