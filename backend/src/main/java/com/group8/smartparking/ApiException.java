package com.group8.smartparking;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    public final HttpStatus status;
    public ApiException(HttpStatus status, String msg) {
        super(msg);
        this.status = status;
    }
}
